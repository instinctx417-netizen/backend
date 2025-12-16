const Candidate = require('../models/Candidate');
const JobRequest = require('../models/JobRequest');
const UserOrganization = require('../models/UserOrganization');
const Notification = require('../models/Notification');

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




