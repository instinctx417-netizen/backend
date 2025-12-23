const InterviewLog = require('../models/InterviewLog');
const User = require('../models/User');

/**
 * Get interview logs with filters and pagination (admin only)
 */
exports.getInterviewLogs = async (req, res) => {
  try {
    const viewer = await User.findById(req.userId);
    if (!viewer || viewer.user_type !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can view interview logs',
      });
    }

    const {
      interviewId,
      actionType,
      performedByUserId,
      organizationId,
      startDate,
      endDate,
      page,
      limit = 20
    } = req.query;

    const filters = {};
    if (interviewId) filters.interviewId = parseInt(interviewId);
    if (actionType) filters.actionType = actionType;
    if (performedByUserId) filters.performedByUserId = parseInt(performedByUserId);
    if (organizationId) filters.organizationId = parseInt(organizationId);
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;

    const options = {};
    if (page) {
      options.page = parseInt(page);
      options.limit = parseInt(limit);
    }

    const result = await InterviewLog.findAll(filters, options);

    if (result.pagination) {
      res.json({
        success: true,
        data: {
          logs: result.data.map(log => ({
            id: log.id,
            interviewId: log.interview_id,
            actionType: log.action_type,
            performedByUserId: log.performed_by_user_id,
            performedByUserType: log.performed_by_user_type,
            performedByUserName: log.performed_by_user_name,
            oldValue: log.old_value,
            newValue: log.new_value,
            details: log.details,
            createdAt: log.created_at,
            jobTitle: log.job_title,
            candidateName: log.candidate_name,
            organizationName: log.organization_name
          })),
          pagination: result.pagination
        }
      });
    } else {
      res.json({
        success: true,
        data: {
          logs: result.map(log => ({
            id: log.id,
            interviewId: log.interview_id,
            actionType: log.action_type,
            performedByUserId: log.performed_by_user_id,
            performedByUserType: log.performed_by_user_type,
            performedByUserName: log.performed_by_user_name,
            oldValue: log.old_value,
            newValue: log.new_value,
            details: log.details,
            createdAt: log.created_at,
            jobTitle: log.job_title,
            candidateName: log.candidate_name,
            organizationName: log.organization_name
          }))
        }
      });
    }
  } catch (error) {
    console.error('Get interview logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};


