const InvitationLog = require('../models/InvitationLog');
const User = require('../models/User');

/**
 * Get invitation logs with filters and pagination (admin only)
 */
exports.getInvitationLogs = async (req, res) => {
  try {
    const viewer = await User.findById(req.userId);
    if (!viewer || viewer.user_type !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can view invitation logs',
      });
    }

    const {
      invitationId,
      actionType,
      performedByUserId,
      organizationId,
      email,
      startDate,
      endDate,
      page,
      limit = 20
    } = req.query;

    const filters = {};
    if (invitationId) filters.invitationId = parseInt(invitationId);
    if (actionType) filters.actionType = actionType;
    if (performedByUserId) filters.performedByUserId = parseInt(performedByUserId);
    if (organizationId) filters.organizationId = parseInt(organizationId);
    if (email) filters.email = email;
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;

    const options = {};
    if (page) {
      options.page = parseInt(page);
      options.limit = parseInt(limit);
    }

    const result = await InvitationLog.findAll(filters, options);

    if (result.pagination) {
      res.json({
        success: true,
        data: {
          logs: result.data.map(log => ({
            id: log.id,
            invitationId: log.invitation_id,
            actionType: log.action_type,
            performedByUserId: log.performed_by_user_id,
            performedByUserType: log.performed_by_user_type,
            performedByUserName: log.performed_by_user_name,
            email: log.email,
            organizationId: log.organization_id,
            organizationName: log.organization_name,
            details: log.details,
            createdAt: log.created_at
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
            invitationId: log.invitation_id,
            actionType: log.action_type,
            performedByUserId: log.performed_by_user_id,
            performedByUserType: log.performed_by_user_type,
            performedByUserName: log.performed_by_user_name,
            email: log.email,
            organizationId: log.organization_id,
            organizationName: log.organization_name,
            details: log.details,
            createdAt: log.created_at
          }))
        }
      });
    }
  } catch (error) {
    console.error('Get invitation logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};


