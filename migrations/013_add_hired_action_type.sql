-- Add 'hired' action type to interview_logs
ALTER TABLE interview_logs 
DROP CONSTRAINT IF EXISTS interview_logs_action_type_check;

ALTER TABLE interview_logs 
ADD CONSTRAINT interview_logs_action_type_check 
CHECK (action_type IN (
    'created', 
    'status_changed', 
    'updated', 
    'cancelled', 
    'completed', 
    'participant_added', 
    'participant_removed', 
    'rescheduled',
    'hired'
));

