const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const path = require('path');
const { randomUUID } = require('crypto');

const REGION = process.env.AWS_REGION;
const BUCKET = process.env.S3_BUCKET_UPLOADS;

if (!BUCKET) {
  console.warn('[S3] S3_BUCKET_UPLOADS is not set. File uploads will fail until this is configured.');
}

const s3Client = new S3Client({
  region: REGION,
});

/**
 * Build a unique S3 object key inside a logical "folder" (prefix)
 * e.g. buildS3Key('resumes', 'cv.pdf') -> 'resumes/cv-<uuid>.pdf'
 */
function buildS3Key(prefix, originalName) {
  const ext = path.extname(originalName) || '';
  const base = path
    .basename(originalName, ext)
    .replace(/\s+/g, '-')
    .toLowerCase();
  const unique = randomUUID();
  return `${prefix}/${base}-${unique}${ext}`;
}

/**
 * Upload a buffer to S3
 */
async function uploadFileToS3(buffer, key, contentType) {
  if (!BUCKET) {
    throw new Error('S3 bucket not configured');
  }

  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  });

  await s3Client.send(command);
  return key;
}

module.exports = {
  buildS3Key,
  uploadFileToS3,
};


