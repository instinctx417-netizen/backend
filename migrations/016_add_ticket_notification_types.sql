-- Add ticket notification types to the notifications table CHECK constraint

-- Drop the existing constraint
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

-- Add the constraint with all notification types (existing + new ticket types)
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check 
  CHECK (type IN (
    -- Existing types
    'invitation_sent',
    'invitation_approved',
    'invitation_rejected',
    'job_request_received',
    'job_assigned',
    'candidates_delivered',
    'interview_scheduled',
    'interview_reminder',
    'selection_reminder',
    'status_update',
    -- Organization management
    'organization_activated',
    'organization_deactivated',
    -- Job requests
    'job_request_created',
    'job_request_updated',
    'job_request_assigned',
    -- Candidates
    'candidate_added',
    'candidate_selected',
    -- Interviews
    'interview_updated',
    'interview_cancelled',
    -- Invitations
    'invitation_accepted',
    -- System announcements
    'system_announcement',
    -- Ticket types
    'ticket_created',
    'ticket_message',
    'ticket_assigned'
  ));

