const Interview = require('../models/Interview');
const Candidate = require('../models/Candidate');
const JobRequest = require('../models/JobRequest');
const UserOrganization = require('../models/UserOrganization');
const Notification = require('../models/Notification');

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

    // Create notifications
    // Notify candidate (if they have a user account)
    if (candidate.user_id) {
      await Notification.create({
        userId: candidate.user_id,
        type: 'interview_scheduled',
        title: 'Interview Scheduled',
        message: `You have an interview scheduled for ${jobRequest.title}`,
        relatedEntityType: 'interview',
        relatedEntityId: interview.id
      });
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

    const updated = await Interview.update(id, req.body);

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

    // Create notification
    await Notification.create({
      userId,
      type: 'interview_scheduled',
      title: 'Interview Invitation',
      message: `You have been invited to an interview for ${interview.job_title}`,
      relatedEntityType: 'interview',
      relatedEntityId: id
    });

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

    const interviews = await Interview.findAll();

    res.json({
      success: true,
      data: { interviews },
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

    const interviews = await Interview.findByAssignedHR(req.userId);

    res.json({
      success: true,
      data: { interviews },
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
    const interviews = await Interview.findByParticipant(req.userId);

    res.json({
      success: true,
      data: { interviews },
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

    const interviews = await Interview.findByOrganization(organizationId);

    res.json({
      success: true,
      data: { interviews },
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




