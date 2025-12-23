-- Create site_staff table
CREATE TABLE IF NOT EXISTS site_staff (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    candidate_id INTEGER NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    job_request_id INTEGER NOT NULL REFERENCES job_requests(id) ON DELETE CASCADE,
    organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    position_title VARCHAR(255) NOT NULL,
    hired_at TIMESTAMP DEFAULT NOW(),
    resigned_at TIMESTAMP,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resigned')),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_site_staff_user_id ON site_staff(user_id);
CREATE INDEX IF NOT EXISTS idx_site_staff_candidate_id ON site_staff(candidate_id);
CREATE INDEX IF NOT EXISTS idx_site_staff_job_request_id ON site_staff(job_request_id);
CREATE INDEX IF NOT EXISTS idx_site_staff_organization_id ON site_staff(organization_id);
CREATE INDEX IF NOT EXISTS idx_site_staff_status ON site_staff(status);
CREATE INDEX IF NOT EXISTS idx_site_staff_hired_at ON site_staff(hired_at DESC);

-- Add comment
COMMENT ON TABLE site_staff IS 'Tracks candidates who have been hired and converted to site staff';

-- Update trigger for updated_at column
DROP TRIGGER IF EXISTS update_site_staff_updated_at ON site_staff;
CREATE TRIGGER update_site_staff_updated_at BEFORE UPDATE ON site_staff
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

