const JobRequest = require('../models/JobRequest');
const Candidate = require('../models/Candidate');
const User = require('../models/User');
const Notification = require('../models/Notification');
const UserOrganization = require('../models/UserOrganization');

/**
 * Get job requests assigned to HR user
 */
exports.getAssignedJobRequests = async (req, res) => {
  try {
    // Verify user is HR
    const user = await User.findById(req.userId);
    if (!user || user.user_type !== 'hr') {
      return res.status(403).json({
        success: false,
        message: 'Only HR users can access this endpoint',
      });
    }

    const { page, limit } = req.query;
    const pageNum = page ? parseInt(page, 10) || 1 : null;
    const limitNum = limit ? parseInt(limit, 10) || 10 : 10;

    const result = pageNum
      ? await JobRequest.findByAssignedHR(req.userId, { page: pageNum, limit: limitNum })
      : await JobRequest.findByAssignedHR(req.userId);

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
    console.error('Get assigned job requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Get all registered candidate users (HR and Admin only)
 */
exports.getCandidateUsers = async (req, res) => {
  try {
    // Verify user is HR or Admin
    const user = await User.findById(req.userId);
    if (!user || (user.user_type !== 'hr' && user.user_type !== 'admin')) {
      return res.status(403).json({
        success: false,
        message: 'Only HR and Admin users can access this endpoint',
      });
    }

    const { page, limit } = req.query;
    const pageNum = page ? parseInt(page, 10) || 1 : null;
    const limitNum = limit ? parseInt(limit, 10) || 10 : 10;

    const result = pageNum
      ? await User.findByType('candidate', { page: pageNum, limit: limitNum })
      : await User.findByType('candidate');

    const candidateUsers = pageNum ? result.data : result;
    const pagination = pageNum ? result.pagination : undefined;
    
    // Format candidate users
    const formatUserData = (user) => {
      return {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        fullName: user.full_name,
        phone: user.phone,
        userType: user.user_type,
        location: user.location,
        country: user.country,
        primaryFunction: user.primary_function,
        yearsExperience: user.years_experience,
        currentRole: user.current_role,
        linkedIn: user.linkedin_url,
        portfolio: user.portfolio_url,
        createdAt: user.created_at,
      };
    };
    const formattedCandidates = candidateUsers.map(u => formatUserData(u));

    res.json({
      success: true,
      data: { 
        candidates: formattedCandidates,
        ...(pagination ? { pagination } : {}),
      },
    });
  } catch (error) {
    console.error('Get candidate users error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Push candidates to a job request (HR and Admin only)
 * Now accepts array of candidate user IDs
 */
exports.pushCandidates = async (req, res) => {
  try {
    // Verify user is HR or Admin
    const user = await User.findById(req.userId);
    if (!user || (user.user_type !== 'hr' && user.user_type !== 'admin')) {
      return res.status(403).json({
        success: false,
        message: 'Only HR and Admin users can push candidates',
      });
    }

    const { jobRequestId } = req.params;
    const { candidateUserIds } = req.body; // Array of candidate user IDs

    if (!candidateUserIds || !Array.isArray(candidateUserIds) || candidateUserIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Candidate user IDs array is required',
      });
    }

    if (candidateUserIds.length > 5) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 5 candidates allowed per job request',
      });
    }

    // Verify job request exists
    const jobRequest = await JobRequest.findById(jobRequestId);
    if (!jobRequest) {
      return res.status(404).json({
        success: false,
        message: 'Job request not found',
      });
    }

    // For HR users, verify job request is assigned to them
    // Admin users can push candidates to any job request
    if (user.user_type === 'hr' && jobRequest.assigned_to_hr_user_id !== parseInt(req.userId)) {
      return res.status(403).json({
        success: false,
        message: 'This job request is not assigned to you',
      });
    }

    // Get candidate users and create candidate records
    const createdCandidates = [];
    for (const candidateUserId of candidateUserIds) {
      const candidateUser = await User.findById(candidateUserId);
      if (!candidateUser || candidateUser.user_type !== 'candidate') {
        continue; // Skip invalid candidate users
      }

      // Check if candidate is already linked to this job request
      const existingCandidates = await Candidate.findByJobRequest(jobRequestId);
      const alreadyExists = existingCandidates.some(c => c.user_id === parseInt(candidateUserId));
      if (alreadyExists) {
        continue; // Skip if already added
      }

      // Create candidate record linked to the user
      const candidate = await Candidate.create({
        jobRequestId,
        userId: candidateUser.id,
        name: candidateUser.full_name || `${candidateUser.first_name} ${candidateUser.last_name}`,
        email: candidateUser.email,
        phone: candidateUser.phone,
        linkedinUrl: candidateUser.linkedin_url,
        portfolioUrl: candidateUser.portfolio_url,
        resumePath: candidateUser.resume_path,
        profileSummary: candidateUser.why_instinctx || null,
      });
      createdCandidates.push(candidate);
    }

    // If all candidates were duplicates, return success with informative message
    if (createdCandidates.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'All selected candidates were already linked to this job request.',
        data: { candidates: [] },
      });
    }

    // Update job request status to candidates_delivered (if not already)
    // Don't update if status is already candidates_delivered to allow multiple pushes
    if (jobRequest.status !== 'candidates_delivered') {
      await JobRequest.update(jobRequestId, {
        status: 'candidates_delivered',
        candidatesDeliveredAt: new Date(),
      });
    } else {
      // Update the delivered timestamp even if status is already candidates_delivered
      await JobRequest.update(jobRequestId, {
        candidatesDeliveredAt: new Date(),
      });
    }

    // Get organization users with COO and HR COO roles
    const orgUsers = await UserOrganization.findByOrganization(jobRequest.organization_id);
    const cooAndHrCooUserIds = orgUsers
      .filter(orgUser => orgUser.role === 'coo')
      .map(orgUser => orgUser.user_id);

    // Send notifications to all COO and HR COO users
    if (cooAndHrCooUserIds.length > 0) {
      const { createNotificationsForUsers } = require('../utils/notificationService');
      const { sendCandidatesDeliveredEmail } = require('../utils/emailService');
      
      // Create notifications for all COO/HR COO users
      await createNotificationsForUsers(req, cooAndHrCooUserIds, {
        type: 'candidates_delivered',
        title: 'New Candidates Ready for Review',
        message: `${createdCandidates.length} new candidates ready for review.`,
        relatedEntityType: 'job_request',
        relatedEntityId: jobRequestId,
      });

      // Send email notifications
      try {
        for (const userId of cooAndHrCooUserIds) {
          const user = await User.findById(userId);
          if (user && user.email) {
            await sendCandidatesDeliveredEmail(
              user.email,
              `${user.first_name} ${user.last_name}`,
              jobRequest.title,
              createdCandidates.length,
              jobRequestId,
              user.user_type
            );
          }
        }
      } catch (emailError) {
        console.error('Error sending candidates delivered emails:', emailError);
        // Don't fail if email fails
      }
    }

    res.status(201).json({
      success: true,
      message: `Successfully delivered ${createdCandidates.length} candidate(s)`,
      data: { candidates: createdCandidates },
    });
  } catch (error) {
    console.error('Push candidates error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Get HR dashboard statistics
 */
exports.getDashboardStats = async (req, res) => {
  try {
    // Verify user is HR
    const user = await User.findById(req.userId);
    if (!user || user.user_type !== 'hr') {
      return res.status(403).json({
        success: false,
        message: 'Only HR users can access this endpoint',
      });
    }

    const stats = await JobRequest.getHRStatistics(req.userId);

    res.json({
      success: true,
      data: { statistics: stats },
    });
  } catch (error) {
    console.error('Get HR dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

