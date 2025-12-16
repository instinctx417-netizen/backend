-- Remove unique constraint on organization names
-- This allows multiple organizations to have the same name
ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_name_key;

