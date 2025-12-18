const { validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const UserInvitation = require('../models/UserInvitation');
const UserOrganization = require('../models/UserOrganization');
const Organization = require('../models/Organization');
const multer = require('multer');
const { buildS3Key, uploadFileToS3 } = require('../utils/s3');

// Multer instance for candidate file uploads (keeps files in memory to send to S3)
const upload = multer({ storage: multer.memoryStorage() });

// Expose as middleware for routes
exports.uploadCandidateFilesMiddleware = upload.fields([
  { name: 'profileImage', maxCount: 1 },
  { name: 'resume', maxCount: 1 },
  { name: 'supportingDocs', maxCount: 10 },
]);
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
    profilePicPath: user.profile_pic_path,
    candidateDocuments:
      user.candidate_documents_json && typeof user.candidate_documents_json === 'string'
        ? (() => {
            try {
              return JSON.parse(user.candidate_documents_json);
            } catch {
              return user.candidate_documents_json;
            }
          })()
        : user.candidate_documents_json || null,
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
 * Register a candidate with file uploads saved to S3.
 * This is used by the public candidate application form.
 */
exports.registerCandidateWithFiles = async (req, res) => {
  try {
    // Run the same validation rules as regular registration
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const {
      email,
      password,
      firstName,
      lastName,
      userType,
      phone,
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
    } = req.body;

    // This endpoint is only for candidates
    if (userType !== 'candidate') {
      return res.status(400).json({
        success: false,
        message: 'Invalid user type for this endpoint',
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

    // Files from multer
    const profileFile = req.files?.profileImage?.[0];
    const resumeFile = req.files?.resume?.[0];
    const supportingFiles = req.files?.supportingDocs || [];

    const imageMimeTypes = ['image/png', 'image/jpeg', 'image/tiff'];
    const docMimeTypes = ['image/png', 'image/jpeg', 'image/tiff', 'application/pdf'];
    const maxSizeBytes = 5 * 1024 * 1024; // 5MB

    // Helper to validate file
    const validateFile = (file, allowedTypes, label) => {
      if (!allowedTypes.includes(file.mimetype)) {
        throw new Error(`${label} has invalid file type`);
      }
      if (file.size > maxSizeBytes) {
        throw new Error(`${label} exceeds maximum size of 5MB`);
      }
    };

    // Upload profile picture
    let profilePicKey = null;
    if (profileFile) {
      validateFile(profileFile, imageMimeTypes, 'Profile picture');
      const key = buildS3Key('profile-pics', profileFile.originalname);
      await uploadFileToS3(profileFile.buffer, key, profileFile.mimetype);
      profilePicKey = key;
    }

    // Upload resume
    let resumeKey = null;
    if (resumeFile) {
      validateFile(resumeFile, docMimeTypes, 'Resume');
      const key = buildS3Key('resumes', resumeFile.originalname);
      await uploadFileToS3(resumeFile.buffer, key, resumeFile.mimetype);
      resumeKey = key;
    }

    // Upload other documents
    const candidateDocKeys = [];
    for (const file of supportingFiles) {
      validateFile(file, docMimeTypes, 'Supporting document');
      const key = buildS3Key('candidate-documents', file.originalname);
      await uploadFileToS3(file.buffer, key, file.mimetype);
      candidateDocKeys.push(key);
    }

    // Create user as candidate, saving the resume key path
    const candidateDocumentsJson = candidateDocKeys.length > 0 ? candidateDocKeys : null;

    const user = await User.create({
      email,
      password,
      firstName,
      lastName,
      userType: 'candidate',
      phone,
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
      // Store resume path (existing column)
      resumePath: resumeKey,
      // New S3-backed fields
      profilePicPath: profilePicKey,
      candidateDocumentsJson,
    });

    // Format user data
    const formattedUser = await formatUserData(user);

    // For candidates, we don't log them in; account is for office use only
    return res.status(201).json({
      success: true,
      message: 'Candidate registered successfully',
      data: {
        user: formattedUser,
        // No token returned
        profilePicKey,
        resumeKey,
        candidateDocKeys,
      },
    });
  } catch (error) {
    console.error('Candidate registration with files error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
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

