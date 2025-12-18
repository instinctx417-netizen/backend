-- Add S3 file path fields for candidate uploads
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS profile_pic_path VARCHAR(500),
  ADD COLUMN IF NOT EXISTS candidate_documents_json JSONB;


