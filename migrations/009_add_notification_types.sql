-- Add new notification types to the notifications table CHECK constraint
-- This migration adds support for organization activation/deactivation and other notification types
-- Updated to include ticket notification types for compatibility with migration 016

-- Drop the existing constraint
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

-- Add the constraint with all notification types (existing + new + ticket types)
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
    -- New types for organization management
    'organization_activated',
    'organization_deactivated',
    -- New types for job requests
    'job_request_created',
    'job_request_updated',
    'job_request_assigned',
    -- New types for candidates
    'candidate_added',
    'candidate_selected',
    -- New types for interviews
    'interview_updated',
    'interview_cancelled',
    -- New types for invitations
    'invitation_accepted',
    -- System announcements
    'system_announcement',
    -- Ticket types (included for compatibility with migration 016)
    'ticket_created',
    'ticket_message',
    'ticket_assigned'
  ));

