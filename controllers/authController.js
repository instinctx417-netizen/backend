const { validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const UserInvitation = require('../models/UserInvitation');
const UserOrganization = require('../models/UserOrganization');
const Organization = require('../models/Organization');
const jwtConfig = require('../config/jwt');

/**
 * Generate JWT token
 */
const generateToken = (userId) => {
  return jwt.sign({ userId }, jwtConfig.secret, {
    expiresIn: jwtConfig.expiresIn,
  });
};

/**
 * Format user data for response (exclude sensitive data)
 */
const formatUserData = async (user) => {
  let jobFunctions = null;
  if (user.job_functions) {
    try {
      jobFunctions = typeof user.job_functions === 'string' 
        ? JSON.parse(user.job_functions) 
        : user.job_functions;
    } catch (e) {
      jobFunctions = user.job_functions;
    }
  }

  // Get user's role from organization if they are a client
  let role = null;
  if (user.user_type === 'client') {
    const userOrgs = await UserOrganization.findByUser(user.id);
    if (userOrgs && userOrgs.length > 0) {
      // Get role from primary organization, or first organization if no primary
      const primaryOrg = userOrgs.find(org => org.is_primary) || userOrgs[0];
      role = primaryOrg.role || null;
    }
  }

  return {
    id: user.id,
    email: user.email,
    firstName: user.first_name,
    lastName: user.last_name,
    userType: user.user_type,
    role: role,
    createdAt: user.created_at,
    // Client fields
    companyName: user.company_name,
    industry: user.industry,
    companySize: user.company_size,
    contactName: user.contact_name,
    phone: user.phone,
    hireType: user.hire_type,
    engagementType: user.engagement_type,
    timeline: user.timeline,
    jobFunctions: jobFunctions,
    specificNeeds: user.specific_needs,
    heardFrom: user.heard_from,
    // Candidate fields
    fullName: user.full_name,
    location: user.location,
    country: user.country,
    timezone: user.timezone,
    primaryFunction: user.primary_function,
    yearsExperience: user.years_experience,
    currentRole: user.current_role,
    education: user.education,
    englishProficiency: user.english_proficiency,
    availability: user.availability,
    linkedIn: user.linkedin_url,
    portfolio: user.portfolio_url,
    whyInstinctX: user.why_instinctx,
    startupExperience: user.startup_experience,
    resumePath: user.resume_path,
  };
};

/**
 * Register a new user
 */
exports.register = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const {
      email, password, firstName, lastName, userType, invitationToken, phone,
      // Client fields
      companyName, industry, companySize, contactName,
      hireType, engagementType, timeline, jobFunctions, specificNeeds, heardFrom,
      // Candidate fields
      fullName, location, country, timezone, primaryFunction, yearsExperience,
      currentRole, education, englishProficiency, availability,
      linkedIn, portfolio, whyInstinctX, startupExperience, resumePath
    } = req.body;

    let invitation = null;
    let finalEmail = email;
    let finalUserType = userType;

    // Handle invitation token
    if (invitationToken) {
      invitation = await UserInvitation.findByToken(invitationToken);
      
      if (!invitation) {
        return res.status(404).json({
          success: false,
          message: 'Invitation not found',
        });
      }

      if (invitation.status !== 'approved') {
        return res.status(400).json({
          success: false,
          message: 'Invitation is not approved yet',
        });
      }

      if (new Date(invitation.expires_at) < new Date()) {
        return res.status(400).json({
          success: false,
          message: 'Invitation has expired',
        });
      }

      // Use email from invitation (cannot be changed)
      finalEmail = invitation.email;
      finalUserType = 'client'; // Invited users are always clients
    } else {
      // Regular registration - check if user already exists
      const existingUser = await User.findByEmail(email);
      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: 'User with this email already exists',
        });
      }

      // Validate userType for regular registration
      if (!['client', 'candidate'].includes(userType)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid user type',
        });
      }
    }

    // Create user with all form data
    const user = await User.create({
      email: finalEmail,
      password,
      firstName,
      lastName,
      userType: finalUserType,
      // Client fields
      companyName,
      industry,
      companySize,
      contactName,
      phone,
      hireType,
      engagementType,
      timeline,
      jobFunctions,
      specificNeeds,
      heardFrom,
      // Candidate fields
      fullName,
      location,
      country,
      timezone,
      primaryFunction,
      yearsExperience,
      currentRole,
      education,
      englishProficiency,
      availability,
      linkedIn,
      portfolio,
      whyInstinctX,
      startupExperience,
      resumePath,
    });

    // If invitation exists, link user to organization and mark invitation as accepted
    if (invitation) {
      // Link user to organization
      await UserOrganization.create({
        userId: user.id,
        organizationId: invitation.organization_id,
        departmentId: invitation.department_id,
        role: invitation.role,
        isPrimary: true,
      });

      // Mark invitation as accepted
      await UserInvitation.accept(invitationToken);
    } else if (finalUserType === 'client') {
      // Auto-create organization for client users during regular registration
      const organizationName = companyName;
      
      const organization = await Organization.create({
        name: organizationName,
        industry: industry || null,
        companySize: companySize || null,
      });

      // Link user to the created organization as primary
      await UserOrganization.create({
        userId: user.id,
        organizationId: organization.id,
        departmentId: null,
        role: 'coo', // Primary client user is the COO (Chief Operating Officer)
        isPrimary: true,
      });
    }

    // Generate token
    const token = generateToken(user.id);

    // Format user data with role
    const formattedUser = await formatUserData(user);

    // Return user data (without password)
    res.status(201).json({
      success: true,
      message: invitation ? 'Account created successfully. You have been added to the organization.' : 'User registered successfully',
      data: {
        user: formattedUser,
        token,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Login user
 */
exports.login = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const { email, password } = req.body;

    // Find user
    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Verify password
    const isPasswordValid = await User.verifyPassword(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Generate token
    const token = generateToken(user.id);

    // Format user data with role
    const formattedUser = await formatUserData(user);

    // Return user data (without password)
    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: formattedUser,
        token,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Get current user profile
 */
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Format user data with role
    const formattedUser = await formatUserData(user);

    res.json({
      success: true,
      data: {
        user: formattedUser,
      },
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Verify token
 */
exports.verifyToken = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Format user data with role
    const formattedUser = await formatUserData(user);

    res.json({
      success: true,
      data: {
        user: formattedUser,
      },
    });
  } catch (error) {
    console.error('Verify token error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

