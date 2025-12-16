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

    // Create notification for admins
    // Note: In production, query for admin users (user_type = 'admin' or specific admin role)
    // For now, we'll create a notification that can be picked up by admin dashboard
    // The admin dashboard should query for notifications with type 'job_request_received'

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
    const candidates = await Candidate.findByJobRequest(id);
    const interviewsRaw = await Interview.findByJobRequest(id);

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
    const { status, departmentId } = req.query;

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

    const jobRequests = await JobRequest.findByOrganization(organizationId, filters);

    res.json({
      success: true,
      data: { jobRequests },
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

