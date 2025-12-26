-- Remove UNIQUE constraint to allow users to share the same post multiple times (Facebook style)
ALTER TABLE community_post_shares DROP CONSTRAINT IF EXISTS community_post_shares_post_id_user_id_key;

