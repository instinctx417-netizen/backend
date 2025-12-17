-- Remove department_id column from user_invitations table
ALTER TABLE user_invitations
DROP COLUMN IF EXISTS department_id;

-- Remove department_id column from user_organizations table
ALTER TABLE user_organizations
DROP COLUMN IF EXISTS department_id;

-- Drop index on department_id in user_organizations
DROP INDEX IF EXISTS idx_user_orgs_dept;

