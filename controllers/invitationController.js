const UserInvitation = require('../models/UserInvitation');
const UserOrganization = require('../models/UserOrganization');
const User = require('../models/User');
const Notification = require('../models/Notification');

/**
 * Format invitation data for response (convert snake_case to camelCase)
 */
const formatInvitationData = (invitation) => {
  if (!invitation) return null;
  
  return {
    id: invitation.id,
    organizationId: invitation.organization_id,
    invitedByUserId: invitation.invited_by_user_id,
    email: invitation.email,
    role: invitation.role,
    token: invitation.token,
    status: invitation.status,
    verifiedByAdminId: invitation.verified_by_admin_id,
    verifiedAt: invitation.verified_at,
    expiresAt: invitation.expires_at,
    createdAt: invitation.created_at,
    updatedAt: invitation.updated_at,
    invitedByFirstName: invitation.invited_by_first_name,
    invitedByLastName: invitation.invited_by_last_name,
    verifiedByFirstName: invitation.verified_by_first_name,
    verifiedByLastName: invitation.verified_by_last_name,
  };
};

/**
 * Create a new invitation
 */
exports.create = async (req, res) => {
  try {
    const { organizationId } = req.params;
    const { email, role } = req.body;

    // Verify user has permission (HR Coordinator or COO)
    const userOrg = await UserOrganization.findByUserAndOrganization(req.userId, organizationId);
    if (!userOrg || !['hr_coordinator', 'coo'].includes(userOrg.role)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to invite users',
      });
    }

    // Check if user already exists in organization
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      const existingUserOrg = await UserOrganization.findByUserAndOrganization(
        existingUser.id,
        organizationId
      );
      if (existingUserOrg) {
        return res.status(409).json({
          success: false,
          message: 'User is already a member of this organization',
        });
      }
    }

    // Check for pending invitation
    const pendingInvitations = await UserInvitation.findByOrganization(organizationId);
    const existingInvitation = pendingInvitations.find(
      inv => inv.email === email && inv.status === 'pending'
    );
    if (existingInvitation) {
      return res.status(409).json({
        success: false,
        message: 'An invitation has already been sent to this email',
      });
    }

    const invitation = await UserInvitation.create({
      organizationId,
      invitedByUserId: req.userId,
      email,
      role
    });

    // Create notification for admins (they need to verify)
    // Note: In production, query for admin users and notify them

    res.status(201).json({
      success: true,
      message: 'Invitation sent successfully. It will be verified by admin before activation.',
      data: { invitation: formatInvitationData(invitation) },
    });
  } catch (error) {
    console.error('Create invitation error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Get invitations for organization
 */
exports.getByOrganization = async (req, res) => {
  try {
    const { organizationId } = req.params;

    // Verify user has access
    const userOrg = await UserOrganization.findByUserAndOrganization(req.userId, organizationId);
    if (!userOrg || !['hr_coordinator', 'coo'].includes(userOrg.role)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view invitations',
      });
    }

    const { page, limit } = req.query;

    const pageNum = page ? parseInt(page, 10) || 1 : null;
    const limitNum = limit ? parseInt(limit, 10) || 10 : 10;

    const result = pageNum
      ? await UserInvitation.findByOrganization(organizationId, { page: pageNum, limit: limitNum })
      : await UserInvitation.findByOrganization(organizationId);

    const invitations = pageNum ? result.data : result;
    const pagination = pageNum ? result.pagination : undefined;

    res.json({
      success: true,
      data: { 
        invitations: invitations.map(formatInvitationData),
        ...(pagination ? { pagination } : {}),
      },
    });
  } catch (error) {
    console.error('Get invitations error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Get invitation by token (for signup page)
 */
exports.getByToken = async (req, res) => {
  try {
    const { token } = req.params;
    const invitation = await UserInvitation.findByToken(token);

    if (!invitation) {
      return res.status(404).json({
        success: false,
        message: 'Invitation not found',
      });
    }

    // Check if expired
    if (new Date(invitation.expires_at) < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Invitation has expired',
      });
    }

    res.json({
      success: true,
      data: { invitation: formatInvitationData(invitation) },
    });
  } catch (error) {
    console.error('Get invitation by token error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};


