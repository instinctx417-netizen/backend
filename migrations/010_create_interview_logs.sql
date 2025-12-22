-- Create interview_logs table
CREATE TABLE IF NOT EXISTS interview_logs (
    id SERIAL PRIMARY KEY,
    interview_id INTEGER NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
    action_type VARCHAR(50) NOT NULL CHECK (action_type IN (
        'created', 
        'status_changed', 
        'updated', 
        'cancelled', 
        'completed', 
        'participant_added', 
        'participant_removed', 
        'rescheduled'
    )),
    performed_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    performed_by_user_type VARCHAR(20) CHECK (performed_by_user_type IN ('admin', 'hr', 'client')),
    performed_by_user_name VARCHAR(255),
    old_value JSONB,
    new_value JSONB,
    details JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_interview_logs_interview_id ON interview_logs(interview_id);
CREATE INDEX IF NOT EXISTS idx_interview_logs_action_type ON interview_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_interview_logs_performed_by_user_id ON interview_logs(performed_by_user_id);
CREATE INDEX IF NOT EXISTS idx_interview_logs_created_at ON interview_logs(created_at DESC);

-- Add comment
COMMENT ON TABLE interview_logs IS 'Logs all interview-related activities for audit purposes';

