-- =====================================================
-- CLIENT PORTAL DATABASE SCHEMA
-- Designed for scalability, performance, and enterprise-grade operations
-- =====================================================

-- Organizations table (Client companies)
CREATE TABLE IF NOT EXISTS organizations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  industry VARCHAR(255),
  company_size VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(name)
);

CREATE INDEX IF NOT EXISTS idx_organizations_name ON organizations(name);

-- Departments within organizations
CREATE TABLE IF NOT EXISTS departments (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(organization_id, name)
);

CREATE INDEX IF NOT EXISTS idx_departments_organization ON departments(organization_id);

-- Link users to organizations and departments
CREATE TABLE IF NOT EXISTS user_organizations (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('hr_coordinator', 'coo', 'manager', 'member')),
  is_primary BOOLEAN DEFAULT false,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, organization_id)
);

CREATE INDEX IF NOT EXISTS idx_user_orgs_user ON user_organizations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_orgs_org ON user_organizations(organization_id);
-- User invitations (invite workflow)
CREATE TABLE IF NOT EXISTS user_invitations (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  invited_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('hr_coordinator', 'coo', 'manager', 'member')),
  department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
  token VARCHAR(255) UNIQUE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'accepted', 'expired')),
  verified_by_admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  verified_at TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_invitations_org ON user_invitations(organization_id);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON user_invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON user_invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON user_invitations(status);

-- Job requests (client job postings)
CREATE TABLE IF NOT EXISTS job_requests (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
  requested_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hiring_manager_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  job_description TEXT NOT NULL,
  requirements TEXT,
  timeline_to_hire VARCHAR(100),
  priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status VARCHAR(50) NOT NULL DEFAULT 'received' CHECK (status IN (
    'received', 
    'assigned_to_hr', 
    'shortlisting', 
    'candidates_delivered', 
    'interviews_scheduled', 
    'selection_pending', 
    'offer_sent', 
    'hired', 
    'closed', 
    'cancelled'
  )),
  assigned_to_hr_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMP,
  candidates_delivered_at TIMESTAMP,
  last_reminder_sent_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_job_requests_org ON job_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_job_requests_dept ON job_requests(department_id);
CREATE INDEX IF NOT EXISTS idx_job_requests_status ON job_requests(status);
CREATE INDEX IF NOT EXISTS idx_job_requests_assigned_hr ON job_requests(assigned_to_hr_user_id);
CREATE INDEX IF NOT EXISTS idx_job_requests_hiring_manager ON job_requests(hiring_manager_user_id);

-- Candidates (linked to job requests)
CREATE TABLE IF NOT EXISTS candidates (
  id SERIAL PRIMARY KEY,
  job_request_id INTEGER NOT NULL REFERENCES job_requests(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL, -- If candidate is also a user
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  linkedin_url VARCHAR(500),
  portfolio_url VARCHAR(500),
  resume_path VARCHAR(500),
  profile_summary TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'delivered' CHECK (status IN (
    'delivered',
    'viewed',
    'shortlisted',
    'interview_scheduled',
    'interview_completed',
    'selected',
    'rejected',
    'offer_sent',
    'hired'
  )),
  delivered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  viewed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_candidates_job_request ON candidates(job_request_id);
CREATE INDEX IF NOT EXISTS idx_candidates_user ON candidates(user_id);
CREATE INDEX IF NOT EXISTS idx_candidates_status ON candidates(status);

-- Interviews
CREATE TABLE IF NOT EXISTS interviews (
  id SERIAL PRIMARY KEY,
  job_request_id INTEGER NOT NULL REFERENCES job_requests(id) ON DELETE CASCADE,
  candidate_id INTEGER NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  scheduled_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMP NOT NULL,
  duration_minutes INTEGER DEFAULT 60,
  meeting_link VARCHAR(500),
  meeting_platform VARCHAR(50), -- 'zoom', 'google_meet', 'teams', etc.
  status VARCHAR(50) NOT NULL DEFAULT 'scheduled' CHECK (status IN (
    'scheduled',
    'confirmed',
    'completed',
    'cancelled',
    'rescheduled'
  )),
  notes TEXT,
  feedback TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_interviews_job_request ON interviews(job_request_id);
CREATE INDEX IF NOT EXISTS idx_interviews_candidate ON interviews(candidate_id);
CREATE INDEX IF NOT EXISTS idx_interviews_scheduled_at ON interviews(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_interviews_status ON interviews(status);

-- Interview participants (users invited to interviews)
CREATE TABLE IF NOT EXISTS interview_participants (
  id SERIAL PRIMARY KEY,
  interview_id INTEGER NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(50) DEFAULT 'attendee' CHECK (role IN ('organizer', 'attendee')),
  confirmed BOOLEAN DEFAULT false,
  confirmed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(interview_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_interview_participants_interview ON interview_participants(interview_id);
CREATE INDEX IF NOT EXISTS idx_interview_participants_user ON interview_participants(user_id);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL CHECK (type IN (
    'invitation_sent',
    'invitation_approved',
    'invitation_rejected',
    'job_request_received',
    'job_assigned',
    'candidates_delivered',
    'interview_scheduled',
    'interview_reminder',
    'selection_reminder',
    'status_update'
  )),
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  related_entity_type VARCHAR(50), -- 'job_request', 'interview', 'invitation', etc.
  related_entity_id INTEGER,
  read BOOLEAN DEFAULT false,
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_entity ON notifications(related_entity_type, related_entity_id);

-- Activity logs (for audit trail)
CREATE TABLE IF NOT EXISTS activity_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  organization_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id INTEGER,
  details JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_org ON activity_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON activity_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at DESC);

-- Update triggers for updated_at columns
DROP TRIGGER IF EXISTS update_organizations_updated_at ON organizations;
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_departments_updated_at ON departments;
CREATE TRIGGER update_departments_updated_at BEFORE UPDATE ON departments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_invitations_updated_at ON user_invitations;
CREATE TRIGGER update_user_invitations_updated_at BEFORE UPDATE ON user_invitations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_job_requests_updated_at ON job_requests;
CREATE TRIGGER update_job_requests_updated_at BEFORE UPDATE ON job_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_candidates_updated_at ON candidates;
CREATE TRIGGER update_candidates_updated_at BEFORE UPDATE ON candidates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_interviews_updated_at ON interviews;
CREATE TRIGGER update_interviews_updated_at BEFORE UPDATE ON interviews
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE organizations IS 'Client companies/organizations';
COMMENT ON TABLE departments IS 'Departments within client organizations';
COMMENT ON TABLE user_organizations IS 'Many-to-many relationship between users and organizations with roles';
COMMENT ON TABLE user_invitations IS 'User invitation workflow with admin verification';
COMMENT ON TABLE job_requests IS 'Job postings/requests from clients';
COMMENT ON TABLE candidates IS 'Candidates delivered to job requests';
COMMENT ON TABLE interviews IS 'Scheduled interviews between candidates and clients';
COMMENT ON TABLE interview_participants IS 'Users invited to participate in interviews';
COMMENT ON TABLE notifications IS 'System notifications for users';
COMMENT ON TABLE activity_logs IS 'Audit trail for all system activities';




