-- Allow NULL values for content column to support shared posts
ALTER TABLE community_posts ALTER COLUMN content DROP NOT NULL;

