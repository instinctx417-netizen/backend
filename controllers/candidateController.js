const Candidate = require('../models/Candidate');
const JobRequest = require('../models/JobRequest');
const UserOrganization = require('../models/UserOrganization');
const Notification = require('../models/Notification');
const User = require('../models/User');

/**
 * Get candidates for a job request
 */
exports.getByJobRequest = async (req, res) => {
  try {
    const { jobRequestId } = req.params;

    // Verify user has access to the job request
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

    const candidates = await Candidate.findByJobRequest(jobRequestId);

    res.json({
      success: true,
      data: { candidates },
    });
  } catch (error) {
    console.error('Get candidates error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Get candidate by ID
 */
exports.getById = async (req, res) => {
  try {
    const { id } = req.params;
    const candidate = await Candidate.findById(id);

    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: 'Candidate not found',
      });
    }

    // Verify user has access
    const jobRequest = await JobRequest.findById(candidate.job_request_id);
    const userOrg = await UserOrganization.findByUserAndOrganization(
      req.userId,
      jobRequest.organization_id
    );
    if (!userOrg) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this candidate',
      });
    }

    // Mark as viewed if not already
    if (candidate.status === 'delivered') {
      await Candidate.updateStatus(id, 'viewed');
    }

    res.json({
      success: true,
      data: { candidate },
    });
  } catch (error) {
    console.error('Get candidate error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Update candidate status
 */
exports.updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const candidate = await Candidate.findById(id);
    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: 'Candidate not found',
      });
    }

    // Verify user has access
    const jobRequest = await JobRequest.findById(candidate.job_request_id);
    const userOrg = await UserOrganization.findByUserAndOrganization(
      req.userId,
      jobRequest.organization_id
    );
    if (!userOrg) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this candidate',
      });
    }

    const updated = await Candidate.updateStatus(id, status);

    // Notify about candidate selection
    if (status === 'selected') {
      try {
        const UserOrganization = require('../models/UserOrganization');
        const { notifyCandidateSelected } = require('../utils/notificationService');
        
        // Get all users in the organization
        const orgUsers = await UserOrganization.findByOrganization(jobRequest.organization_id);
        if (orgUsers && orgUsers.length > 0) {
          const userIds = orgUsers.map(uo => uo.user_id);
          // Also notify assigned HR if exists
          if (jobRequest.assigned_to_hr_user_id && !userIds.includes(jobRequest.assigned_to_hr_user_id)) {
            userIds.push(jobRequest.assigned_to_hr_user_id);
          }
          const candidateName = updated.candidate_name || updated.name || 'Candidate';
          await notifyCandidateSelected(
            req,
            userIds,
            parseInt(id),
            candidateName,
            jobRequest.id,
            jobRequest.title || jobRequest.job_title
          );
        }
      } catch (notifError) {
        console.error('Error sending candidate selection notification:', notifError);
        // Don't fail the request if notification fails
      }
    }

    res.json({
      success: true,
      message: 'Candidate status updated successfully',
      data: { candidate: updated },
    });
  } catch (error) {
    console.error('Update candidate status error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Get detailed candidate user profile (admin & HR only)
 * Uses data from the users table (candidate signup), not the candidates table.
 */
exports.getCandidateUserDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const viewer = await User.findById(req.userId);
    if (!viewer || !['admin', 'hr'].includes(viewer.user_type)) {
      return res.status(403).json({
        success: false,
        message: 'Only admins and HR users can view candidate profiles',
      });
    }

    const candidateUser = await User.findById(id);
    if (!candidateUser || candidateUser.user_type !== 'candidate') {
      return res.status(404).json({
        success: false,
        message: 'Candidate user not found',
      });
    }

    let candidateDocuments = null;
    if (candidateUser.candidate_documents_json) {
      try {
        candidateDocuments =
          typeof candidateUser.candidate_documents_json === 'string'
            ? JSON.parse(candidateUser.candidate_documents_json)
            : candidateUser.candidate_documents_json;
      } catch {
        candidateDocuments = candidateUser.candidate_documents_json;
      }
    }

    const formatted = {
      id: candidateUser.id,
      email: candidateUser.email,
      firstName: candidateUser.first_name,
      lastName: candidateUser.last_name,
      fullName: candidateUser.full_name,
      phone: candidateUser.phone,
      userType: candidateUser.user_type,
      location: candidateUser.location,
      country: candidateUser.country,
      timezone: candidateUser.timezone,
      primaryFunction: candidateUser.primary_function,
      yearsExperience: candidateUser.years_experience,
      currentRole: candidateUser.current_role,
      education: candidateUser.education,
      englishProficiency: candidateUser.english_proficiency,
      availability: candidateUser.availability,
      linkedIn: candidateUser.linkedin_url,
      portfolio: candidateUser.portfolio_url,
      whyInstinctX: candidateUser.why_instinctx,
      startupExperience: candidateUser.startup_experience,
      resumePath: candidateUser.resume_path,
      profilePicPath: candidateUser.profile_pic_path,
      candidateDocuments,
      createdAt: candidateUser.created_at,
      updatedAt: candidateUser.updated_at,
    };

    res.json({
      success: true,
      data: { candidate: formatted },
    });
  } catch (error) {
    console.error('Get candidate user details error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};
