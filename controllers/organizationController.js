const Organization = require('../models/Organization');
const Department = require('../models/Department');
const UserOrganization = require('../models/UserOrganization');
const User = require('../models/User');

/**
 * Create organization (typically done during client registration)
 */
exports.create = async (req, res) => {
  try {
    const { name, industry, companySize } = req.body;

    // Check if organization already exists
    const existing = await Organization.findByName(name);
    if (existing) {
      // If organization exists, check if user is already linked
      const userOrg = await UserOrganization.findByUserAndOrganization(req.userId, existing.id);
      if (userOrg) {
        return res.status(200).json({
          success: true,
          message: 'Organization already exists and you are a member',
          data: { organization: existing },
        });
      }
      // Link user to existing organization
      await UserOrganization.create({
        userId: req.userId,
        organizationId: existing.id,
        role: 'coo', // Default role for creator
        isPrimary: true,
      });
      return res.status(200).json({
        success: true,
        message: 'Organization already exists. You have been linked to it.',
        data: { organization: existing },
      });
    }

    const organization = await Organization.create({
      name,
      industry,
      companySize,
    });

    // Automatically link the creating user to the organization
    await UserOrganization.create({
      userId: req.userId,
      organizationId: organization.id,
      role: 'coo', // Default role for creator
      isPrimary: true,
    });

    res.status(201).json({
      success: true,
      message: 'Organization created successfully',
      data: { organization },
    });
  } catch (error) {
    console.error('Create organization error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Get organization details
 */
exports.getById = async (req, res) => {
  try {
    const { id } = req.params;
    const organization = await Organization.findByIdWithDepartments(id);

    if (!organization) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found',
      });
    }

    res.json({
      success: true,
      data: { organization },
    });
  } catch (error) {
    console.error('Get organization error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Get staff members for organization (Client and HR COO only)
 */
exports.getOrganizationStaff = async (req, res) => {
  try {
    const { organizationId } = req.params;
    const { page, limit } = req.query;
    const pageNum = page ? parseInt(page, 10) || 1 : null;
    const limitNum = limit ? parseInt(limit, 10) || 10 : 10;

    // Verify user has access to this organization
    const userOrg = await UserOrganization.findByUserAndOrganization(req.userId, organizationId);
    if (!userOrg) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this organization',
      });
    }

    // Verify user is client or HR COO
    const user = await User.findById(req.userId);
    if (!user || (user.user_type !== 'client' && (user.user_type !== 'hr' || userOrg.role !== 'hr_coo'))) {
      return res.status(403).json({
        success: false,
        message: 'Only clients and HR COO can view staff members',
      });
    }

    const pool = require('../config/database');
    const SiteStaff = require('../models/SiteStaff');

    // Build query to get staff members for this organization
    let query = `
      SELECT DISTINCT u.*, 
        ss.id as staff_id,
        ss.position_title,
        ss.hired_at
      FROM users u
      INNER JOIN site_staff ss ON ss.user_id = u.id
      WHERE ss.organization_id = $1 AND ss.status = 'active'
    `;
    const params = [organizationId];
    
    query += ' ORDER BY ss.hired_at DESC';

    // Handle pagination
    let totalCount = null;
    if (pageNum && limitNum) {
      // Build count query
      let countQuery = `
        SELECT COUNT(DISTINCT u.id) as count
        FROM users u
        INNER JOIN site_staff ss ON ss.user_id = u.id
        WHERE ss.organization_id = $1 AND ss.status = 'active'
      `;
      
      const countResult = await pool.query(countQuery, [organizationId]);
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
    console.error('Get organization staff error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Get user's organizations
 */
exports.getUserOrganizations = async (req, res) => {
  try {
    const userOrgs = await UserOrganization.findByUser(req.userId);

    // Format response to use 'id' as organization_id (remove confusing user_organizations.id)
    const formattedOrgs = userOrgs.map(uo => ({
      id: uo.organization_id, // Use organization_id as the main id
      user_id: uo.user_id,
      role: uo.role,
      is_primary: uo.is_primary,
      joined_at: uo.joined_at,
      name: uo.organization_name, // Use 'name' as the standard field
      industry: uo.industry,
      company_size: uo.company_size,
      status: uo.status,
    }));

    res.json({
      success: true,
      data: { organizations: formattedOrgs },
    });
  } catch (error) {
    console.error('Get user organizations error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Get organization users (team members)
 */
exports.getOrganizationUsers = async (req, res) => {
  try {
    const { organizationId } = req.params;

    // Verify user has access to this organization
    const userOrg = await UserOrganization.findByUserAndOrganization(req.userId, organizationId);
    if (!userOrg) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this organization',
      });
    }

    const orgUsers = await UserOrganization.findByOrganization(organizationId);

    // Format users
    const formattedUsers = orgUsers.map(uo => ({
      id: uo.user_id,
      email: uo.email,
      firstName: uo.first_name,
      lastName: uo.last_name,
      role: uo.role,
      isPrimary: uo.is_primary,
    }));

    res.json({
      success: true,
      data: { users: formattedUsers },
    });
  } catch (error) {
    console.error('Get organization users error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Create department
 */
exports.createDepartment = async (req, res) => {
  try {
    const { organizationId } = req.params;
    const { name, description } = req.body;

    // Verify user has access to this organization
    const userOrg = await UserOrganization.findByUserAndOrganization(req.userId, organizationId);
    if (!userOrg || !['hr_coordinator', 'coo'].includes(userOrg.role)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to create departments',
      });
    }

    const department = await Department.create({
      organizationId,
      name,
      description,
    });

    res.status(201).json({
      success: true,
      message: 'Department created successfully',
      data: { department },
    });
  } catch (error) {
    console.error('Create department error:', error);
    if (error.code === '23505') { // Unique violation
      return res.status(409).json({
        success: false,
        message: 'Department with this name already exists',
      });
    }
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Get organization departments
 */
exports.getDepartments = async (req, res) => {
  try {
    const { organizationId } = req.params;
    const departments = await Department.findByOrganization(organizationId);

    res.json({
      success: true,
      data: { departments },
    });
  } catch (error) {
    console.error('Get departments error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

