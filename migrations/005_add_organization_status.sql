-- Add status column to organizations table
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'inactive' CHECK (status IN ('active', 'inactive'));

-- Update existing organizations to be inactive by default
UPDATE organizations SET status = 'inactive' WHERE status IS NULL;

-- Add index for status column for better query performance
CREATE INDEX IF NOT EXISTS idx_organizations_status ON organizations(status);

