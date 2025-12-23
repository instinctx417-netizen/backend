const User = require('../models/User');
const UserInvitation = require('../models/UserInvitation');
const Notification = require('../models/Notification');
const InvitationLog = require('../models/InvitationLog');
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

    const { status, page, limit } = req.query;
    let result;

    const pageNum = page ? parseInt(page, 10) || 1 : null;
    const limitNum = limit ? parseInt(limit, 10) || 10 : 10;

    if (status === 'approved') {
      result = pageNum
        ? await UserInvitation.findApproved({ page: pageNum, limit: limitNum })
        : await UserInvitation.findApproved();
    } else {
      // Default to pending
      result = pageNum
        ? await UserInvitation.findPending({ page: pageNum, limit: limitNum })
        : await UserInvitation.findPending();
    }

    const invitations = pageNum ? result.data : result;
    const pagination = pageNum ? result.pagination : undefined;

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
      status: inv.status,
      expiresAt: inv.expires_at,
      verifiedAt: inv.verified_at,
      createdAt: inv.created_at,
    }));

    res.json({
      success: true,
      data: { 
        invitations: formattedInvitations,
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

    // Log invitation approval
    try {
      const admin = await User.findById(req.userId);
      await InvitationLog.create({
        invitationId: parseInt(invitationId),
        actionType: 'approved',
        performedByUserId: req.userId,
        performedByUserType: admin?.user_type || null,
        performedByUserName: admin ? `${admin.first_name} ${admin.last_name}` : null,
        email: invitation.email,
        organizationId: invitation.organization_id,
        details: {
          role: invitation.role
        }
      });
    } catch (logError) {
      console.error('Error logging invitation approval:', logError);
      // Don't fail the request if logging fails
    }

    // Notify the user who sent the invitation
    try {
      const { notifyInvitationApproved } = require('../utils/notificationService');
      if (invitation.invited_by_user_id) {
        await notifyInvitationApproved(
          req,
          invitation.invited_by_user_id,
          invitation.id,
          invitation.email
        );
      }
    } catch (notifError) {
      console.error('Error sending approval notification:', notifError);
      // Don't fail the request if notification fails
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

    // Log invitation rejection
    try {
      const admin = await User.findById(req.userId);
      await InvitationLog.create({
        invitationId: parseInt(invitationId),
        actionType: 'rejected',
        performedByUserId: req.userId,
        performedByUserType: admin?.user_type || null,
        performedByUserName: admin ? `${admin.first_name} ${admin.last_name}` : null,
        email: invitation.email,
        organizationId: invitation.organization_id,
        details: {
          role: invitation.role
        }
      });
    } catch (logError) {
      console.error('Error logging invitation rejection:', logError);
      // Don't fail the request if logging fails
    }

    // Notify the user who sent the invitation
    try {
      const { notifyInvitationRejected } = require('../utils/notificationService');
      if (invitation.invited_by_user_id) {
        await notifyInvitationRejected(
          req,
          invitation.invited_by_user_id,
          invitation.id,
          invitation.email
        );
      }
    } catch (notifError) {
      console.error('Error sending rejection notification:', notifError);
      // Don't fail the request if notification fails
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

    const { page, limit } = req.query;
    const pageNum = page ? parseInt(page, 10) || 1 : null;
    const limitNum = limit ? parseInt(limit, 10) || 10 : 10;

    const result = pageNum
      ? await User.findByType('hr', { page: pageNum, limit: limitNum })
      : await User.findByType('hr');

    const hrUsers = pageNum ? result.data : result;
    const pagination = pageNum ? result.pagination : undefined;

    // Format users (exclude password and convert to camelCase)
    const formattedUsers = hrUsers.map(user => formatUserData(user));

    res.json({
      success: true,
      data: { 
        users: formattedUsers,
        ...(pagination ? { pagination } : {}),
      },
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

    // Notify HR user about assignment
    try {
      const { notifyJobRequestAssigned } = require('../utils/notificationService');
      await notifyJobRequestAssigned(
        req,
        hrUserId,
        parseInt(jobRequestId),
        jobRequest.title || jobRequest.job_title
      );
    } catch (notifError) {
      console.error('Error sending job request assignment notification:', notifError);
      // Don't fail the request if notification fails
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

    const { status, page, limit } = req.query;
    const JobRequest = require('../models/JobRequest');
    const filters = {};
    if (status) filters.status = status;

    // Optional pagination
    const pageNum = page ? parseInt(page, 10) || 1 : null;
    const limitNum = limit ? parseInt(limit, 10) || 10 : 10;

    const result = pageNum
      ? await JobRequest.findAll(filters, { page: pageNum, limit: limitNum })
      : await JobRequest.findAll(filters);

    const jobRequests = pageNum ? result.data : result;
    const pagination = pageNum ? result.pagination : undefined;

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
      data: { 
        jobRequests: formattedJobRequests,
        ...(pagination ? { pagination } : {}),
      },
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
    const { page, limit } = req.query;

    const pageNum = page ? parseInt(page, 10) || 1 : null;
    const limitNum = limit ? parseInt(limit, 10) || 10 : 10;

    const result = pageNum
      ? await Organization.findAll({ page: pageNum, limit: limitNum })
      : await Organization.findAll();

    const organizations = pageNum ? result.data : result;
    const pagination = pageNum ? result.pagination : undefined;

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
      data: { 
        organizations: formattedOrganizations,
        ...(pagination ? { pagination } : {}),
      },
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
 * Get all staff members (admin only)
 * Returns users who have active site_staff records
 */
exports.getStaffMembers = async (req, res) => {
  try {
    // Verify user is admin
    const admin = await User.findById(req.userId);
    if (!admin || admin.user_type !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can view staff members',
      });
    }

    const { page, limit } = req.query;
    const pageNum = page ? parseInt(page, 10) || 1 : null;
    const limitNum = limit ? parseInt(limit, 10) || 10 : 10;

    const pool = require('../config/database');
    const SiteStaff = require('../models/SiteStaff');

    // Build query to get staff members (users with active site_staff records)
    let query = `
      SELECT DISTINCT u.*, 
        ss.id as staff_id,
        ss.position_title,
        ss.hired_at,
        ss.organization_id,
        o.name as organization_name
      FROM users u
      INNER JOIN site_staff ss ON ss.user_id = u.id
      LEFT JOIN organizations o ON o.id = ss.organization_id
      WHERE ss.status = 'active'
    `;
    const params = [];
    
    query += ' ORDER BY ss.hired_at DESC';

    // Handle pagination
    let totalCount = null;
    if (pageNum && limitNum) {
      // Build count query
      let countQuery = `
        SELECT COUNT(DISTINCT u.id) as count
        FROM users u
        INNER JOIN site_staff ss ON ss.user_id = u.id
        WHERE ss.status = 'active'
      `;
      
      const countResult = await pool.query(countQuery, []);
      totalCount = parseInt(countResult.rows[0].count, 10) || 0;

      const offset = (pageNum - 1) * limitNum;
      query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limitNum, offset);
    }

    const result = await pool.query(query, params);
    const staffUsers = result.rows;

    // Format staff users
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
        // Staff-specific fields
        staffId: user.staff_id,
        positionTitle: user.position_title,
        hiredAt: user.hired_at,
        organizationId: user.organization_id,
        organizationName: user.organization_name,
      };
    };
    const formattedStaff = staffUsers.map(u => formatUserData(u));

    let pagination = undefined;
    if (pageNum && limitNum && totalCount !== null) {
      const totalPages = Math.ceil(totalCount / limitNum);
      pagination = {
        page: pageNum,
        limit: limitNum,
        totalCount,
        totalPages,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1,
      };
    }

    res.json({
      success: true,
      data: { 
        staff: formattedStaff,
        ...(pagination ? { pagination } : {}),
      },
    });
  } catch (error) {
    console.error('Get staff members error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Get all candidate users (admin only)
 * Excludes candidates who have been hired (have active site_staff records)
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

    const { page, limit } = req.query;
    const pageNum = page ? parseInt(page, 10) || 1 : null;
    const limitNum = limit ? parseInt(limit, 10) || 10 : 10;

    const pool = require('../config/database');
    const SiteStaff = require('../models/SiteStaff');

    // Get all hired user IDs (active site staff)
    const hiredStaffQuery = `SELECT DISTINCT user_id FROM site_staff WHERE status = 'active'`;
    const hiredStaffResult = await pool.query(hiredStaffQuery);
    const hiredUserIds = hiredStaffResult.rows.map(row => row.user_id);

    // Build query to exclude hired candidates
    let query = `
      SELECT u.* 
      FROM users u
      WHERE u.user_type = 'candidate'
    `;
    const params = [];
    
    if (hiredUserIds.length > 0) {
      query += ` AND u.id NOT IN (${hiredUserIds.map((_, i) => `$${i + 1}`).join(', ')})`;
      params.push(...hiredUserIds);
    }
    
    query += ' ORDER BY u.created_at DESC';

    // Handle pagination
    let totalCount = null;
    if (pageNum && limitNum) {
      // Build count query without ORDER BY
      let countQuery = `
        SELECT COUNT(*) as count
        FROM users u
        WHERE u.user_type = 'candidate'
      `;
      const countParams = [];
      
      if (hiredUserIds.length > 0) {
        countQuery += ` AND u.id NOT IN (${hiredUserIds.map((_, i) => `$${i + 1}`).join(', ')})`;
        countParams.push(...hiredUserIds);
      }
      
      const countResult = await pool.query(countQuery, countParams);
      totalCount = parseInt(countResult.rows[0].count, 10) || 0;

      const offset = (pageNum - 1) * limitNum;
      query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limitNum, offset);
    }

    const result = await pool.query(query, params);
    const candidateUsers = result.rows;

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

    let pagination = undefined;
    if (pageNum && limitNum && totalCount !== null) {
      const totalPages = Math.ceil(totalCount / limitNum);
      pagination = {
        page: pageNum,
        limit: limitNum,
        totalCount,
        totalPages,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1,
      };
    }

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
    const UserOrganization = require('../models/UserOrganization');
    const { notifyOrganizationActivated } = require('../utils/notificationService');
    
    const organization = await Organization.activate(parseInt(organizationId));
    
    if (!organization) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found',
      });
    }

    // Notify only COO users in the organization
    try {
      const orgUsers = await UserOrganization.findByOrganization(parseInt(organizationId));
      if (orgUsers && orgUsers.length > 0) {
        // Filter only COO role users
        const cooUserIds = orgUsers
          .filter(uo => uo.role === 'coo')
          .map(uo => uo.user_id);
        if (cooUserIds.length > 0) {
          await notifyOrganizationActivated(
            req,
            cooUserIds,
            parseInt(organizationId),
            organization.name || organization.organization_name
          );
        }
      }
    } catch (notifError) {
      console.error('Error sending activation notifications:', notifError);
      // Don't fail the request if notification fails
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
    const UserOrganization = require('../models/UserOrganization');
    const { notifyOrganizationDeactivated } = require('../utils/notificationService');
    
    const organization = await Organization.deactivate(parseInt(organizationId));
    
    if (!organization) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found',
      });
    }

    // Notify only COO users in the organization
    try {
      const orgUsers = await UserOrganization.findByOrganization(parseInt(organizationId));
      if (orgUsers && orgUsers.length > 0) {
        // Filter only COO role users
        const cooUserIds = orgUsers
          .filter(uo => uo.role === 'coo')
          .map(uo => uo.user_id);
        if (cooUserIds.length > 0) {
          await notifyOrganizationDeactivated(
            req,
            cooUserIds,
            parseInt(organizationId),
            organization.name || organization.organization_name
          );
        }
      }
    } catch (notifError) {
      console.error('Error sending deactivation notifications:', notifError);
      // Don't fail the request if notification fails
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
