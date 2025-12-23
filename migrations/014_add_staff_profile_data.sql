-- Add profile_data JSONB column to site_staff table for storing "About Me" information
ALTER TABLE site_staff 
ADD COLUMN IF NOT EXISTS profile_data JSONB DEFAULT '{}'::jsonb;

-- Add comment
COMMENT ON COLUMN site_staff.profile_data IS 'Stores staff profile information like favorite food, movie, hobbies, etc.';

