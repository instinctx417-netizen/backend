-- Create invitation_logs table
CREATE TABLE IF NOT EXISTS invitation_logs (
    id SERIAL PRIMARY KEY,
    invitation_id INTEGER NOT NULL REFERENCES user_invitations(id) ON DELETE CASCADE,
    action_type VARCHAR(50) NOT NULL CHECK (action_type IN (
        'created', 
        'sent', 
        'approved', 
        'rejected', 
        'accepted', 
        'link_accessed', 
        'expired', 
        'resent', 
        'cancelled'
    )),
    performed_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    performed_by_user_type VARCHAR(20) CHECK (performed_by_user_type IN ('admin', 'hr', 'client')),
    performed_by_user_name VARCHAR(255),
    email VARCHAR(255) NOT NULL,
    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
    details JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_invitation_logs_invitation_id ON invitation_logs(invitation_id);
CREATE INDEX IF NOT EXISTS idx_invitation_logs_action_type ON invitation_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_invitation_logs_performed_by_user_id ON invitation_logs(performed_by_user_id);
CREATE INDEX IF NOT EXISTS idx_invitation_logs_email ON invitation_logs(email);
CREATE INDEX IF NOT EXISTS idx_invitation_logs_organization_id ON invitation_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_invitation_logs_created_at ON invitation_logs(created_at DESC);

-- Add comment
COMMENT ON TABLE invitation_logs IS 'Logs all invitation-related activities for audit purposes';

