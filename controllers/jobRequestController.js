const JobRequest = require('../models/JobRequest');
const Candidate = require('../models/Candidate');
const Interview = require('../models/Interview');
const UserOrganization = require('../models/UserOrganization');
const Notification = require('../models/Notification');

/**
 * Create a new job request
 */
exports.create = async (req, res) => {
  try {
    const { organizationId } = req.params; // Get from URL params
    const {
      departmentId,
      hiringManagerUserId,
      title,
      jobDescription,
      requirements,
      timelineToHire,
      priority
    } = req.body;

    // Verify user has access to this organization
    const userOrg = await UserOrganization.findByUserAndOrganization(req.userId, organizationId);
    if (!userOrg) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this organization',
      });
    }

    const jobRequest = await JobRequest.create({
      organizationId,
      departmentId,
      requestedByUserId: req.userId,
      hiringManagerUserId,
      title,
      jobDescription,
      requirements,
      timelineToHire,
      priority
    });

    // Notify admins about new job request
    try {
      const User = require('../models/User');
      const Organization = require('../models/Organization');
      const { notifyJobRequestCreated } = require('../utils/notificationService');
      
      // Get all admin users
      const adminUsers = await User.findByType('admin');
      if (adminUsers && adminUsers.length > 0) {
        const adminUserIds = adminUsers.map(admin => admin.id);
        const organization = await Organization.findById(organizationId);
        await notifyJobRequestCreated(
          req,
          adminUserIds,
          jobRequest.id,
          title,
          organization?.name || 'organization'
        );
      }
    } catch (notifError) {
      console.error('Error sending job request notification:', notifError);
      // Don't fail the request if notification fails
    }

    res.status(201).json({
      success: true,
      message: 'Job request created successfully. Admin will be notified to assign HR.',
      data: { jobRequest },
    });
  } catch (error) {
    console.error('Create job request error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Get job request by ID
 */
exports.getById = async (req, res) => {
  try {
    const { id } = req.params;
    const jobRequest = await JobRequest.findById(id);

    if (!jobRequest) {
      return res.status(404).json({
        success: false,
        message: 'Job request not found',
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

    // Admin users have access to all job requests
    if (user.user_type === 'admin') {
      hasAccess = true;
    }
    // HR users have access if the job request is assigned to them
    else if (user.user_type === 'hr') {
      hasAccess = jobRequest.assigned_to_hr_user_id === parseInt(req.userId);
    }
    // Client users have access if they belong to the organization
    else {
      const userOrg = await UserOrganization.findByUserAndOrganization(
        req.userId,
        jobRequest.organization_id
      );
      hasAccess = !!userOrg;
    }

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this job request',
      });
    }

    // Get candidates for this job request
    const candidatesRaw = await Candidate.findByJobRequest(id);
    const interviewsRaw = await Interview.findByJobRequest(id);

    // Format candidates - convert snake_case to camelCase
    const candidates = candidatesRaw.map(candidate => ({
      id: candidate.id,
      jobRequestId: candidate.job_request_id,
      userId: candidate.user_id || null,
      name: candidate.name,
      email: candidate.email || null,
      phone: candidate.phone || null,
      linkedinUrl: candidate.linkedin_url || null,
      portfolioUrl: candidate.portfolio_url || null,
      resumePath: candidate.resume_path || null,
      profileSummary: candidate.profile_summary || null,
      status: candidate.status,
      deliveredAt: candidate.delivered_at,
      viewedAt: candidate.viewed_at || null,
      interviewCount: parseInt(candidate.interview_count) || 0,
      lastInterviewDate: candidate.last_interview_date || null,
    }));

    // Format interviews - keep snake_case for scheduled_at
    const interviews = interviewsRaw.map(interview => {
      // Ensure scheduled_at is properly converted (PostgreSQL returns it as a Date object or ISO string)
      const scheduled_at = interview.scheduled_at 
        ? (interview.scheduled_at instanceof Date 
            ? interview.scheduled_at.toISOString() 
            : interview.scheduled_at)
        : null;
      
      return {
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
      };
    });

    res.json({
      success: true,
      data: {
        jobRequest: {
          ...jobRequest,
          candidates,
          interviews
        }
      },
    });
  } catch (error) {
    console.error('Get job request error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Get job requests for organization
 */
exports.getByOrganization = async (req, res) => {
  try {
    const { organizationId } = req.params;
    const { status, departmentId, page, limit } = req.query;

    // Verify user has access
    const userOrg = await UserOrganization.findByUserAndOrganization(req.userId, organizationId);
    if (!userOrg) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this organization',
      });
    }

    const filters = {};
    if (status) filters.status = status;
    if (departmentId) filters.departmentId = parseInt(departmentId);

    // Optional pagination
    const pageNum = page ? parseInt(page, 10) || 1 : null;
    const limitNum = limit ? parseInt(limit, 10) || 10 : 10;

    const result = pageNum
      ? await JobRequest.findByOrganization(organizationId, filters, { page: pageNum, limit: limitNum })
      : await JobRequest.findByOrganization(organizationId, filters);

    const jobRequests = pageNum ? result.data : result;
    const pagination = pageNum ? result.pagination : undefined;

    res.json({
      success: true,
      data: { 
        jobRequests,
        ...(pagination ? { pagination } : {}),
      },
    });
  } catch (error) {
    console.error('Get job requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Get job requests by department
 */
exports.getByDepartment = async (req, res) => {
  try {
    const { departmentId } = req.params;
    const jobRequests = await JobRequest.findByDepartment(departmentId);

    res.json({
      success: true,
      data: { jobRequests },
    });
  } catch (error) {
    console.error('Get job requests by department error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Update job request
 */
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const jobRequest = await JobRequest.findById(id);

    if (!jobRequest) {
      return res.status(404).json({
        success: false,
        message: 'Job request not found',
      });
    }

    // Verify user has access
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

    const updated = await JobRequest.update(id, req.body);

    // Notify relevant users about job request update
    try {
      const UserOrganization = require('../models/UserOrganization');
      const { notifyJobRequestUpdated } = require('../utils/notificationService');
      
      // Get all users in the organization
      const orgUsers = await UserOrganization.findByOrganization(jobRequest.organization_id);
      if (orgUsers && orgUsers.length > 0) {
        const userIds = orgUsers.map(uo => uo.user_id);
        // Also notify assigned HR if exists
        if (updated.assigned_to_hr_user_id && !userIds.includes(updated.assigned_to_hr_user_id)) {
          userIds.push(updated.assigned_to_hr_user_id);
        }
        await notifyJobRequestUpdated(
          req,
          userIds,
          parseInt(id),
          updated.title || updated.job_title
        );
      }
    } catch (notifError) {
      console.error('Error sending job request update notification:', notifError);
      // Don't fail the request if notification fails
    }

    res.json({
      success: true,
      message: 'Job request updated successfully',
      data: { jobRequest: updated },
    });
  } catch (error) {
    console.error('Update job request error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Get job request statistics
 */
exports.getStatistics = async (req, res) => {
  try {
    const { organizationId } = req.params;
    const { departmentId } = req.query;

    // Verify user has access
    const userOrg = await UserOrganization.findByUserAndOrganization(req.userId, organizationId);
    if (!userOrg) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this organization',
      });
    }

    const stats = await JobRequest.getStatistics(
      organizationId,
      departmentId ? parseInt(departmentId) : null
    );

    res.json({
      success: true,
      data: { statistics: stats },
    });
  } catch (error) {
    console.error('Get statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

