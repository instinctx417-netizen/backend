-- Add shared_post_id column to community_posts table
ALTER TABLE community_posts 
ADD COLUMN IF NOT EXISTS shared_post_id INTEGER REFERENCES community_posts(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_community_posts_shared_post_id ON community_posts(shared_post_id);

