const User = require('../models/User');
const UserInvitation = require('../models/UserInvitation');
const Notification = require('../models/Notification');
const bcrypt = require('bcryptjs');

/**
 * Format user data for response (convert snake_case to camelCase)
 */
const formatUserData = (user) => {
  if (!user) return null;
  
  return {
    id: user.id,
    email: user.email,
    firstName: user.first_name,
    lastName: user.last_name,
    userType: user.user_type,
    phone: user.phone,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
  };
};

/**
 * Create a new HR user (admin only)
 */
exports.createHR = async (req, res) => {
  try {
    // Verify user is admin
    const admin = await User.findById(req.userId);
    if (!admin || admin.user_type !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can create HR users',
      });
    }

    const { firstName, lastName, email, phone, password } = req.body;

    // Validate required fields
    if (!firstName || !lastName || !email || !phone || !password) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required: firstName, lastName, email, phone, password',
      });
    }

    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'User with this email already exists',
      });
    }

    // Create HR user
    const hrUser = await User.create({
      email,
      password,
      firstName,
      lastName,
      userType: 'hr',
      phone,
    });

    // Format response (exclude password)
    const { password_hash, ...userData } = hrUser;

    res.status(201).json({
      success: true,
      message: 'HR user created successfully',
      data: { user: userData },
    });
  } catch (error) {
    console.error('Create HR user error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Get invitations by status (admin only)
 * Status can be 'pending' or 'approved'
 */
exports.getInvitations = async (req, res) => {
  try {
    // Verify user is admin
    const admin = await User.findById(req.userId);
    if (!admin || admin.user_type !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can view invitations',
      });
    }

    const { status } = req.query;
    let invitations;

    if (status === 'approved') {
      invitations = await UserInvitation.findApproved();
    } else {
      // Default to pending
      invitations = await UserInvitation.findPending();
    }

    // Format invitations
    const formattedInvitations = invitations.map(inv => ({
      id: inv.id,
      organizationId: inv.organization_id,
      organizationName: inv.organization_name,
      invitedByUserId: inv.invited_by_user_id,
      invitedByFirstName: inv.invited_by_first_name,
      invitedByLastName: inv.invited_by_last_name,
      email: inv.email,
      role: inv.role,
      departmentId: inv.department_id,
      departmentName: inv.department_name,
      status: inv.status,
      expiresAt: inv.expires_at,
      verifiedAt: inv.verified_at,
      createdAt: inv.created_at,
    }));

    res.json({
      success: true,
      data: { invitations: formattedInvitations },
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
 * Approve an invitation (admin only)
 */
exports.approveInvitation = async (req, res) => {
  try {
    // Verify user is admin
    const admin = await User.findById(req.userId);
    if (!admin || admin.user_type !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can approve invitations',
      });
    }

    const { invitationId } = req.params;

    const invitation = await UserInvitation.approve(invitationId, req.userId);

    if (!invitation) {
      return res.status(404).json({
        success: false,
        message: 'Invitation not found or already processed',
      });
    }

    // Format invitation data
    const formattedInvitation = {
      id: invitation.id,
      organizationId: invitation.organization_id,
      email: invitation.email,
      role: invitation.role,
      token: invitation.token,
      status: invitation.status,
      expiresAt: invitation.expires_at,
    };

    res.json({
      success: true,
      message: 'Invitation approved successfully',
      data: { invitation: formattedInvitation },
    });
  } catch (error) {
    console.error('Approve invitation error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Reject an invitation (admin only)
 */
exports.rejectInvitation = async (req, res) => {
  try {
    // Verify user is admin
    const admin = await User.findById(req.userId);
    if (!admin || admin.user_type !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can reject invitations',
      });
    }

    const { invitationId } = req.params;

    const invitation = await UserInvitation.reject(invitationId, req.userId);

    if (!invitation) {
      return res.status(404).json({
        success: false,
        message: 'Invitation not found or already processed',
      });
    }

    res.json({
      success: true,
      message: 'Invitation rejected successfully',
    });
  } catch (error) {
    console.error('Reject invitation error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Get invitation link (admin only)
 */
exports.getInvitationLink = async (req, res) => {
  try {
    // Verify user is admin
    const admin = await User.findById(req.userId);
    if (!admin || admin.user_type !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can get invitation links',
      });
    }

    const { invitationId } = req.params;

    const invitation = await UserInvitation.findById(invitationId);

    if (!invitation) {
      return res.status(404).json({
        success: false,
        message: 'Invitation not found',
      });
    }

    if (invitation.status !== 'approved') {
      return res.status(400).json({
        success: false,
        message: 'Invitation must be approved before getting the link',
      });
    }

    // Generate invitation signup link (separate from general signup)
    // Using query parameter to work with static export
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const signupLink = `${frontendUrl}/invite?token=${invitation.token}`;

    res.json({
      success: true,
      data: {
        invitationId: invitation.id,
        email: invitation.email,
        signupLink,
        token: invitation.token,
      },
    });
  } catch (error) {
    console.error('Get invitation link error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Get all HR users (admin only)
 */
exports.getHRUsers = async (req, res) => {
  try {
    // Verify user is admin
    const admin = await User.findById(req.userId);
    if (!admin || admin.user_type !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can view HR users',
      });
    }

    const hrUsers = await User.findByType('hr');

    // Format users (exclude password and convert to camelCase)
    const formattedUsers = hrUsers.map(user => formatUserData(user));

    res.json({
      success: true,
      data: { users: formattedUsers },
    });
  } catch (error) {
    console.error('Get HR users error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Assign HR to job request (admin only)
 */
exports.assignHrToJobRequest = async (req, res) => {
  try {
    // Verify user is admin
    const admin = await User.findById(req.userId);
    if (!admin || admin.user_type !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can assign HR to job requests',
      });
    }

    const { jobRequestId } = req.params;
    const { hrUserId } = req.body;

    if (!hrUserId) {
      return res.status(400).json({
        success: false,
        message: 'HR user ID is required',
      });
    }

    // Verify HR user exists and is HR type
    const hrUser = await User.findById(hrUserId);
    if (!hrUser || hrUser.user_type !== 'hr') {
      return res.status(400).json({
        success: false,
        message: 'Invalid HR user',
      });
    }

    const JobRequest = require('../models/JobRequest');
    const jobRequest = await JobRequest.update(jobRequestId, {
      assignedToHrUserId: hrUserId,
      status: 'assigned_to_hr',
    });

    if (!jobRequest) {
      return res.status(404).json({
        success: false,
        message: 'Job request not found',
      });
    }

    res.json({
      success: true,
      message: 'HR assigned to job request successfully',
      data: { jobRequest },
    });
  } catch (error) {
    console.error('Assign HR to job request error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Get all job requests (admin only)
 */
exports.getAllJobRequests = async (req, res) => {
  try {
    // Verify user is admin
    const admin = await User.findById(req.userId);
    if (!admin || admin.user_type !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can view all job requests',
      });
    }

    const { status } = req.query;
    const JobRequest = require('../models/JobRequest');
    const filters = {};
    if (status) filters.status = status;

    const jobRequests = await JobRequest.findAll(filters);

    // Format job requests
    const formattedJobRequests = jobRequests.map(jr => ({
      id: jr.id,
      organizationId: jr.organization_id,
      organizationName: jr.organization_name,
      departmentId: jr.department_id,
      departmentName: jr.department_name,
      requestedByUserId: jr.requested_by_user_id,
      requestedByFirstName: jr.requested_by_first_name,
      requestedByLastName: jr.requested_by_last_name,
      hiringManagerUserId: jr.hiring_manager_user_id,
      title: jr.title,
      jobDescription: jr.job_description,
      requirements: jr.requirements,
      timelineToHire: jr.timeline_to_hire,
      priority: jr.priority,
      status: jr.status,
      assignedToHrUserId: jr.assigned_to_hr_user_id,
      assignedHrFirstName: jr.assigned_hr_first_name,
      assignedHrLastName: jr.assigned_hr_last_name,
      assignedAt: jr.assigned_at,
      candidatesDeliveredAt: jr.candidates_delivered_at,
      createdAt: jr.created_at,
      updatedAt: jr.updated_at,
      candidateCount: parseInt(jr.candidate_count) || 0,
    }));

    res.json({
      success: true,
      data: { jobRequests: formattedJobRequests },
    });
  } catch (error) {
    console.error('Get all job requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Deliver candidates to job request (admin only - delegates to HR)
 * This is a placeholder - in practice, HR users push candidates
 */
exports.deliverCandidates = async (req, res) => {
  try {
    // Verify user is admin
    const admin = await User.findById(req.userId);
    if (!admin || admin.user_type !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can deliver candidates',
      });
    }

    // This should delegate to HR controller
    const hrController = require('./hrController');
    return hrController.pushCandidates(req, res);
  } catch (error) {
    console.error('Deliver candidates error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Get all organizations (admin only)
 */
exports.getAllOrganizations = async (req, res) => {
  try {
    // Verify user is admin
    const admin = await User.findById(req.userId);
    if (!admin || admin.user_type !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can view all organizations',
      });
    }

    const Organization = require('../models/Organization');
    const organizations = await Organization.findAll();

    // Format organizations
    const formattedOrganizations = organizations.map(org => ({
      id: org.id,
      name: org.name,
      organization_name: org.name,
      industry: org.industry,
      companySize: org.company_size,
      status: org.status,
      createdAt: org.created_at,
      created_at: org.created_at,
    }));

    res.json({
      success: true,
      data: { organizations: formattedOrganizations },
    });
  } catch (error) {
    console.error('Get all organizations error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Get all candidate users (admin only)
 */
exports.getCandidateUsers = async (req, res) => {
  try {
    // Verify user is admin
    const admin = await User.findById(req.userId);
    if (!admin || admin.user_type !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can view all candidates',
      });
    }

    const candidateUsers = await User.findByType('candidate');
    
    // Format candidate users (same format as HR endpoint)
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
      data: { candidates: formattedCandidates },
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
 * Activate organization (admin only)
 */
exports.activateOrganization = async (req, res) => {
  try {
    // Verify user is admin
    const admin = await User.findById(req.userId);
    if (!admin || admin.user_type !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can activate organizations',
      });
    }

    const { organizationId } = req.params;
    const Organization = require('../models/Organization');
    
    const organization = await Organization.activate(parseInt(organizationId));
    
    if (!organization) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found',
      });
    }

    res.json({
      success: true,
      message: 'Organization activated successfully',
      data: { organization },
    });
  } catch (error) {
    console.error('Activate organization error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Deactivate organization (admin only)
 */
exports.deactivateOrganization = async (req, res) => {
  try {
    // Verify user is admin
    const admin = await User.findById(req.userId);
    if (!admin || admin.user_type !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can deactivate organizations',
      });
    }

    const { organizationId } = req.params;
    const Organization = require('../models/Organization');
    
    const organization = await Organization.deactivate(parseInt(organizationId));
    
    if (!organization) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found',
      });
    }

    res.json({
      success: true,
      message: 'Organization deactivated successfully',
      data: { organization },
    });
  } catch (error) {
    console.error('Deactivate organization error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};
