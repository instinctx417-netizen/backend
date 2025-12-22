const Interview = require('../models/Interview');
const Candidate = require('../models/Candidate');
const JobRequest = require('../models/JobRequest');
const UserOrganization = require('../models/UserOrganization');
const Notification = require('../models/Notification');
const InterviewLog = require('../models/InterviewLog');
const User = require('../models/User');

/**
 * Format interview data to camelCase
 */
function formatInterview(interview) {
  if (!interview) return null;
  
  const scheduled_at = interview.scheduled_at 
    ? (interview.scheduled_at instanceof Date 
        ? interview.scheduled_at.toISOString() 
        : interview.scheduled_at)
    : null;

  return {
    id: interview.id,
    jobRequestId: interview.job_request_id || interview.jobRequestId,
    candidateId: interview.candidate_id || interview.candidateId,
    candidateUserId: interview.candidate_user_id || interview.candidateUserId,
    scheduledByUserId: interview.scheduled_by_user_id || interview.scheduledByUserId,
    scheduled_at: scheduled_at,
    durationMinutes: interview.duration_minutes || interview.durationMinutes,
    meetingLink: interview.meeting_link || interview.meetingLink,
    meeting_platform: interview.meeting_platform || interview.meetingPlatform,
    status: interview.status,
    notes: interview.notes,
    feedback: interview.feedback,
    candidate_name: interview.candidate_name,
    candidateEmail: interview.candidate_email || interview.candidateEmail,
    job_title: interview.job_title,
    organization_name: interview.organization_name,
    department_name: interview.department_name,
    scheduled_by_first_name: interview.scheduled_by_first_name,
    scheduled_by_last_name: interview.scheduled_by_last_name,
  };
}

/**
 * Format array of interviews
 */
function formatInterviews(interviews) {
  return interviews.map(formatInterview);
}

/**
 * Create a new interview
 */
exports.create = async (req, res) => {
  try {
    const {
      jobRequestId,
      candidateId,
      scheduledAt,
      scheduled_at,
      durationMinutes,
      meetingLink,
      meetingPlatform,
      notes,
      participantUserIds
    } = req.body;

    const scheduledAtValue = scheduled_at || scheduledAt;

    // Convert datetime-local format to ISO string for PostgreSQL
    // datetime-local returns "YYYY-MM-DDTHH:mm" which needs to be converted to ISO format
    let formattedScheduledAt = scheduledAtValue;
    if (scheduledAtValue && typeof scheduledAtValue === 'string' && scheduledAtValue.includes('T') && !scheduledAtValue.includes('Z') && !scheduledAtValue.includes('+')) {
      // Convert "YYYY-MM-DDTHH:mm" to ISO format
      formattedScheduledAt = new Date(scheduledAtValue).toISOString();
    }
    
    if (!formattedScheduledAt) {
      return res.status(400).json({
        success: false,
        message: 'scheduled_at is required',
      });
    }

    // Verify user has access
    const jobRequest = await JobRequest.findById(jobRequestId);
    if (!jobRequest) {
      return res.status(404).json({
        success: false,
        message: 'Job request not found',
      });
    }

    const userOrg = await UserOrganization.findByUserAndOrganization(
      req.userId,
      jobRequest.organization_id
    );
    if (!userOrg) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this job request',
      });
    }

    // Verify candidate belongs to this job request
    const candidate = await Candidate.findById(candidateId);
    if (!candidate || candidate.job_request_id !== parseInt(jobRequestId)) {
      return res.status(400).json({
        success: false,
        message: 'Candidate does not belong to this job request',
      });
    }

    // Create interview
    const interview = await Interview.create({
      jobRequestId,
      candidateId,
      scheduledByUserId: req.userId,
      scheduledAt: formattedScheduledAt,
      durationMinutes,
      meetingLink,
      meetingPlatform,
      notes
    });

    // Add participants
    if (participantUserIds && participantUserIds.length > 0) {
      for (const userId of participantUserIds) {
        await Interview.addParticipant(interview.id, userId, 'attendee');
      }
    }

    // Add organizer as participant
    await Interview.addParticipant(interview.id, req.userId, 'organizer');

    // Update candidate status
    await Candidate.updateStatus(candidateId, 'interview_scheduled');

    // Update job request status
    await JobRequest.update(jobRequestId, { status: 'interviews_scheduled' });

    // Log interview creation
    try {
      const user = await User.findById(req.userId);
      await InterviewLog.create({
        interviewId: interview.id,
        actionType: 'created',
        performedByUserId: req.userId,
        performedByUserType: user?.user_type || null,
        performedByUserName: user ? `${user.first_name} ${user.last_name}` : null,
        newValue: {
          scheduledAt: formattedScheduledAt,
          durationMinutes: durationMinutes || 60,
          meetingLink,
          meetingPlatform,
          status: 'scheduled'
        },
        details: {
          candidateId,
          jobRequestId,
          participantCount: participantUserIds ? participantUserIds.length + 1 : 1
        }
      });
    } catch (logError) {
      console.error('Error logging interview creation:', logError);
      // Don't fail the request if logging fails
    }

    // Create notifications
    // Notify candidate (if they have a user account)
    if (candidate.user_id) {
      const { notifyInterviewScheduled } = require('../utils/notificationService');
      await notifyInterviewScheduled(
        req,
        candidate.user_id,
        interview.id,
        jobRequest.title
      );
    }

    // Notify participants
    if (participantUserIds && participantUserIds.length > 0) {
      const notifications = participantUserIds.map(userId => ({
        userId,
        type: 'interview_scheduled',
        title: 'Interview Invitation',
        message: `You have been invited to an interview for ${jobRequest.title}`,
        relatedEntityType: 'interview',
        relatedEntityId: interview.id
      }));
      await Notification.bulkCreate(notifications);
    }

    // Get full interview details
    const fullInterview = await Interview.findById(interview.id);
    const participants = await Interview.getParticipants(interview.id);

    res.status(201).json({
      success: true,
      message: 'Interview scheduled successfully',
      data: {
        interview: {
          ...fullInterview,
          participants
        }
      },
    });
  } catch (error) {
    console.error('Create interview error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Get interview by ID
 */
exports.getById = async (req, res) => {
  try {
    const { id } = req.params;
    const interview = await Interview.findById(id);

    if (!interview) {
      return res.status(404).json({
        success: false,
        message: 'Interview not found',
      });
    }

    // Verify user has access
    const userOrg = await UserOrganization.findByUserAndOrganization(
      req.userId,
      interview.organization_id
    );
    if (!userOrg) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this interview',
      });
    }

    const participantsRaw = await Interview.getParticipants(id);

    // Format participants to camelCase
    const participants = participantsRaw.map(p => ({
      id: p.id,
      interviewId: p.interview_id,
      userId: p.user_id,
      role: p.role,
      confirmed: p.confirmed,
      firstName: p.first_name,
      lastName: p.last_name,
      email: p.email,
    }));

    const scheduled_at = interview.scheduled_at 
      ? (interview.scheduled_at instanceof Date 
          ? interview.scheduled_at.toISOString() 
          : interview.scheduled_at)
      : null;
    
    const formattedInterview = {
      id: interview.id,
      jobRequestId: interview.job_request_id,
      candidateId: interview.candidate_id,
      scheduledByUserId: interview.scheduled_by_user_id,
      scheduled_at: scheduled_at,
      durationMinutes: interview.duration_minutes,
      meetingLink: interview.meeting_link,
      meetingPlatform: interview.meeting_platform,
      status: interview.status,
      notes: interview.notes,
      feedback: interview.feedback,
      createdAt: interview.created_at,
      updatedAt: interview.updated_at,
      candidateName: interview.candidate_name,
      candidateEmail: interview.candidate_email,
      jobTitle: interview.job_title,
      scheduledByFirstName: interview.scheduled_by_first_name,
      scheduledByLastName: interview.scheduled_by_last_name,
      participants,
    };

    res.json({
      success: true,
      data: {
        interview: formattedInterview
      },
    });
  } catch (error) {
    console.error('Get interview error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Get interviews for a job request
 */
exports.getByJobRequest = async (req, res) => {
  try {
    const { jobRequestId } = req.params;

    // Verify user has access
    const jobRequest = await JobRequest.findById(jobRequestId);
    if (!jobRequest) {
      return res.status(404).json({
        success: false,
        message: 'Job request not found',
      });
    }

    const userOrg = await UserOrganization.findByUserAndOrganization(
      req.userId,
      jobRequest.organization_id
    );
    if (!userOrg) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this job request',
      });
    }

    const interviews = await Interview.findByJobRequest(jobRequestId);

    res.json({
      success: true,
      data: { interviews },
    });
  } catch (error) {
    console.error('Get interviews error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Get upcoming interviews for organization
 */
exports.getUpcoming = async (req, res) => {
  try {
    const { organizationId } = req.params;
    const { limit } = req.query;

    // Verify user has access
    const userOrg = await UserOrganization.findByUserAndOrganization(req.userId, organizationId);
    if (!userOrg) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this organization',
      });
    }

    const interviews = await Interview.findUpcomingByOrganization(
      organizationId,
      limit ? parseInt(limit) : 10
    );

    res.json({
      success: true,
      data: { interviews },
    });
  } catch (error) {
    console.error('Get upcoming interviews error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Update interview
 */
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const interview = await Interview.findById(id);

    if (!interview) {
      return res.status(404).json({
        success: false,
        message: 'Interview not found',
      });
    }

    // Check user type and access
    const User = require('../models/User');
    const user = await User.findById(req.userId);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found',
      });
    }

    let hasAccess = false;

    // Admin users have access to all interviews
    if (user.user_type === 'admin') {
      hasAccess = true;
    }
    // HR users have access if the interview's job request is assigned to them
    else if (user.user_type === 'hr') {
      const jobRequest = await JobRequest.findById(interview.job_request_id);
      hasAccess = jobRequest && jobRequest.assigned_to_hr_user_id === parseInt(req.userId);
    }
    // Client users have access if they belong to the organization
    else {
      const userOrg = await UserOrganization.findByUserAndOrganization(
        req.userId,
        interview.organization_id
      );
      hasAccess = !!userOrg;
    }

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this interview',
      });
    }

    // Track old values for logging
    const oldValues = {};
    if (req.body.status && interview.status !== req.body.status) {
      oldValues.status = interview.status;
    }
    if (req.body.scheduled_at && interview.scheduled_at !== req.body.scheduled_at) {
      oldValues.scheduled_at = interview.scheduled_at;
    }
    if (req.body.meetingLink && interview.meeting_link !== req.body.meetingLink) {
      oldValues.meetingLink = interview.meeting_link;
    }
    if (req.body.meetingPlatform && interview.meeting_platform !== req.body.meetingPlatform) {
      oldValues.meetingPlatform = interview.meeting_platform;
    }

    const updated = await Interview.update(id, req.body);

    // Log interview update
    try {
      const user = await User.findById(req.userId);
      const newValues = {};
      if (req.body.status) newValues.status = req.body.status;
      if (req.body.scheduled_at) newValues.scheduled_at = req.body.scheduled_at;
      if (req.body.meetingLink) newValues.meetingLink = req.body.meetingLink;
      if (req.body.meetingPlatform) newValues.meetingPlatform = req.body.meetingPlatform;
      if (req.body.durationMinutes) newValues.durationMinutes = req.body.durationMinutes;
      if (req.body.notes !== undefined) newValues.notes = req.body.notes;

      let actionType = 'updated';
      if (req.body.status === 'cancelled' && interview.status !== 'cancelled') {
        actionType = 'cancelled';
      } else if (req.body.status === 'completed' && interview.status !== 'completed') {
        actionType = 'completed';
      } else if (req.body.status && interview.status !== req.body.status) {
        actionType = 'status_changed';
      } else if (req.body.scheduled_at && interview.scheduled_at !== req.body.scheduled_at) {
        actionType = 'rescheduled';
      }

      await InterviewLog.create({
        interviewId: parseInt(id),
        actionType,
        performedByUserId: req.userId,
        performedByUserType: user?.user_type || null,
        performedByUserName: user ? `${user.first_name} ${user.last_name}` : null,
        oldValue: Object.keys(oldValues).length > 0 ? oldValues : null,
        newValue: Object.keys(newValues).length > 0 ? newValues : null,
        details: actionType === 'rescheduled' ? {
          oldScheduledAt: interview.scheduled_at,
          newScheduledAt: req.body.scheduled_at
        } : null
      });
    } catch (logError) {
      console.error('Error logging interview update:', logError);
      // Don't fail the request if logging fails
    }

    // Notify participants about interview update or cancellation
    try {
      const { notifyInterviewUpdated, notifyInterviewCancelled } = require('../utils/notificationService');
      const InterviewParticipant = require('../models/InterviewParticipant');
      const participants = await InterviewParticipant.findByInterview(id);
      
      if (participants && participants.length > 0) {
        const userIds = participants.map(p => p.user_id);
        const interviewTitle = updated.job_title || interview.job_title || 'Interview';
        
        // Check if interview was cancelled
        if (updated.status === 'cancelled' || req.body.status === 'cancelled') {
          await notifyInterviewCancelled(
            req,
            userIds,
            parseInt(id),
            interviewTitle
          );
        } else {
          await notifyInterviewUpdated(
            req,
            userIds,
            parseInt(id),
            interviewTitle
          );
        }
      }
    } catch (notifError) {
      console.error('Error sending interview notification:', notifError);
      // Don't fail the request if notification fails
    }

    res.json({
      success: true,
      message: 'Interview updated successfully',
      data: { interview: updated },
    });
  } catch (error) {
    console.error('Update interview error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Add participant to interview
 */
exports.addParticipant = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, role } = req.body;

    const interview = await Interview.findById(id);
    if (!interview) {
      return res.status(404).json({
        success: false,
        message: 'Interview not found',
      });
    }

    // Verify user has access
    const userOrg = await UserOrganization.findByUserAndOrganization(
      req.userId,
      interview.organization_id
    );
    if (!userOrg) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this interview',
      });
    }

    const participant = await Interview.addParticipant(id, userId, role || 'attendee');

    // Log participant addition
    try {
      const user = await User.findById(req.userId);
      const participantUser = await User.findById(userId);
      await InterviewLog.create({
        interviewId: parseInt(id),
        actionType: 'participant_added',
        performedByUserId: req.userId,
        performedByUserType: user?.user_type || null,
        performedByUserName: user ? `${user.first_name} ${user.last_name}` : null,
        details: {
          participantUserId: userId,
          participantUserName: participantUser ? `${participantUser.first_name} ${participantUser.last_name}` : null,
          participantEmail: participantUser?.email || null,
          role: role || 'attendee'
        }
      });
    } catch (logError) {
      console.error('Error logging participant addition:', logError);
      // Don't fail the request if logging fails
    }

    // Create notification
    const { notifyInterviewScheduled } = require('../utils/notificationService');
    await notifyInterviewScheduled(
      req,
      userId,
      id,
      interview.job_title
    );

    res.json({
      success: true,
      message: 'Participant added successfully',
      data: { participant },
    });
  } catch (error) {
    console.error('Add participant error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Remove participant from interview
 */
exports.removeParticipant = async (req, res) => {
  try {
    const { id, userId } = req.params;

    const interview = await Interview.findById(id);
    if (!interview) {
      return res.status(404).json({
        success: false,
        message: 'Interview not found',
      });
    }

    // Verify user has access
    const userOrg = await UserOrganization.findByUserAndOrganization(
      req.userId,
      interview.organization_id
    );
    if (!userOrg) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this interview',
      });
    }

    await Interview.removeParticipant(id, userId);

    // Log participant removal
    try {
      const user = await User.findById(req.userId);
      const participantUser = await User.findById(userId);
      await InterviewLog.create({
        interviewId: parseInt(id),
        actionType: 'participant_removed',
        performedByUserId: req.userId,
        performedByUserType: user?.user_type || null,
        performedByUserName: user ? `${user.first_name} ${user.last_name}` : null,
        details: {
          participantUserId: userId,
          participantUserName: participantUser ? `${participantUser.first_name} ${participantUser.last_name}` : null,
          participantEmail: participantUser?.email || null
        }
      });
    } catch (logError) {
      console.error('Error logging participant removal:', logError);
      // Don't fail the request if logging fails
    }

    res.json({
      success: true,
      message: 'Participant removed successfully',
    });
  } catch (error) {
    console.error('Remove participant error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Get all interviews (admin only)
 */
exports.getAll = async (req, res) => {
  try {
    const User = require('../models/User');
    const user = await User.findById(req.userId);
    if (!user || user.user_type !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can access all interviews',
      });
    }

    const status = req.query.status && req.query.status !== 'all' ? req.query.status : null;
    const { page, limit } = req.query;

    const pageNum = page ? parseInt(page, 10) || 1 : null;
    const limitNum = limit ? parseInt(limit, 10) || 10 : 10;

    const result = pageNum
      ? await Interview.findAll(status, { page: pageNum, limit: limitNum })
      : await Interview.findAll(status);

    const interviews = pageNum ? result.data : result;
    const pagination = pageNum ? result.pagination : undefined;

    res.json({
      success: true,
      data: { 
        interviews: formatInterviews(interviews),
        ...(pagination ? { pagination } : {}),
      },
    });
  } catch (error) {
    console.error('Get all interviews error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Get interviews for assigned HR job requests
 */
exports.getByAssignedHR = async (req, res) => {
  try {
    const User = require('../models/User');
    const user = await User.findById(req.userId);
    if (!user || user.user_type !== 'hr') {
      return res.status(403).json({
        success: false,
        message: 'Only HR users can access this endpoint',
      });
    }

    const status = req.query.status && req.query.status !== 'all' ? req.query.status : null;
    const { page, limit } = req.query;

    const pageNum = page ? parseInt(page, 10) || 1 : null;
    const limitNum = limit ? parseInt(limit, 10) || 10 : 10;

    const result = pageNum
      ? await Interview.findByAssignedHR(req.userId, status, { page: pageNum, limit: limitNum })
      : await Interview.findByAssignedHR(req.userId, status);

    const interviews = pageNum ? result.data : result;
    const pagination = pageNum ? result.pagination : undefined;

    res.json({
      success: true,
      data: { 
        interviews: formatInterviews(interviews),
        ...(pagination ? { pagination } : {}),
      },
    });
  } catch (error) {
    console.error('Get HR assigned interviews error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Get interviews where user is a participant
 */
exports.getByParticipant = async (req, res) => {
  try {
    const status = req.query.status && req.query.status !== 'all' ? req.query.status : null;
    const { page, limit } = req.query;

    const pageNum = page ? parseInt(page, 10) || 1 : null;
    const limitNum = limit ? parseInt(limit, 10) || 10 : 10;

    const result = pageNum
      ? await Interview.findByParticipant(req.userId, status, { page: pageNum, limit: limitNum })
      : await Interview.findByParticipant(req.userId, status);

    const interviews = pageNum ? result.data : result;
    const pagination = pageNum ? result.pagination : undefined;

    res.json({
      success: true,
      data: { 
        interviews: formatInterviews(interviews),
        ...(pagination ? { pagination } : {}),
      },
    });
  } catch (error) {
    console.error('Get participant interviews error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Get all interviews for organization
 */
exports.getByOrganization = async (req, res) => {
  try {
    const { organizationId } = req.params;

    // Verify user has access
    const userOrg = await UserOrganization.findByUserAndOrganization(req.userId, organizationId);
    if (!userOrg) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this organization',
      });
    }

    const status = req.query.status && req.query.status !== 'all' ? req.query.status : null;
    const { page, limit } = req.query;

    const pageNum = page ? parseInt(page, 10) || 1 : null;
    const limitNum = limit ? parseInt(limit, 10) || 10 : 10;

    const result = pageNum
      ? await Interview.findByOrganization(organizationId, status, { page: pageNum, limit: limitNum })
      : await Interview.findByOrganization(organizationId, status);

    const interviews = pageNum ? result.data : result;
    const pagination = pageNum ? result.pagination : undefined;

    res.json({
      success: true,
      data: { 
        interviews: formatInterviews(interviews),
        ...(pagination ? { pagination } : {}),
      },
    });
  } catch (error) {
    console.error('Get organization interviews error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};




