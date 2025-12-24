const OnboardingRequirement = require('../models/OnboardingRequirement');
const OnboardingSubmission = require('../models/OnboardingSubmission');
const User = require('../models/User');
const { buildS3Key, uploadFileToS3 } = require('../utils/s3');

/**
 * Onboarding Requirements - Admin only
 */

// Get all onboarding requirements
exports.getRequirements = async (req, res) => {
  try {
    const requirements = await OnboardingRequirement.findAll();
    const user = await User.findById(req.userId);
    const targetUserId = req.query.userId ? parseInt(req.query.userId) : req.userId;

    // If staff, include their submissions. If admin, include submissions for target user
    let submissions = [];
    if (user.user_type === 'candidate') {
      submissions = await OnboardingSubmission.findByUser(req.userId);
    } else if (user.user_type === 'admin' && req.query.userId) {
      // Only fetch submissions if userId query param is explicitly provided
      submissions = await OnboardingSubmission.findByUser(targetUserId);
    }

    res.json({
      success: true,
      data: { requirements, submissions },
    });
  } catch (error) {
    console.error('Get requirements error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Create onboarding requirement - Admin only
exports.createRequirement = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (user.user_type !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can create onboarding requirements',
      });
    }

    const { title, description, isRequired, displayOrder } = req.body;

    if (!title) {
      return res.status(400).json({
        success: false,
        message: 'Title is required',
      });
    }

    const requirement = await OnboardingRequirement.create({
      title,
      description: description || null,
      isRequired: isRequired !== undefined ? isRequired : true,
      displayOrder: displayOrder || 0,
      createdByUserId: req.userId,
    });

    res.json({
      success: true,
      message: 'Onboarding requirement created successfully',
      data: { requirement },
    });
  } catch (error) {
    console.error('Create requirement error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Update onboarding requirement - Admin only
exports.updateRequirement = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (user.user_type !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can update onboarding requirements',
      });
    }

    const { id } = req.params;
    const { title, description, isRequired, displayOrder } = req.body;

    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (isRequired !== undefined) updateData.isRequired = isRequired;
    if (displayOrder !== undefined) updateData.displayOrder = displayOrder;

    const requirement = await OnboardingRequirement.update(id, updateData);

    res.json({
      success: true,
      message: 'Onboarding requirement updated successfully',
      data: { requirement },
    });
  } catch (error) {
    console.error('Update requirement error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Delete onboarding requirement - Admin only
exports.deleteRequirement = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (user.user_type !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can delete onboarding requirements',
      });
    }

    const { id } = req.params;
    const requirement = await OnboardingRequirement.delete(id);

    if (!requirement) {
      return res.status(404).json({
        success: false,
        message: 'Requirement not found',
      });
    }

    res.json({
      success: true,
      message: 'Onboarding requirement deleted successfully',
    });
  } catch (error) {
    console.error('Delete requirement error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Onboarding Submissions - Staff only
 */

// Submit file for onboarding requirement - Staff only
exports.submitFile = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (user.user_type !== 'candidate') {
      return res.status(403).json({
        success: false,
        message: 'Only staff can submit onboarding files',
      });
    }

    const { requirementId } = req.body;

    if (!requirementId) {
      return res.status(400).json({
        success: false,
        message: 'Requirement ID is required',
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'File is required',
      });
    }

    // Validate file
    const docMimeTypes = ['image/png', 'image/jpeg', 'image/tiff', 'application/pdf'];
    const maxSizeBytes = 10 * 1024 * 1024; // 10MB

    if (!docMimeTypes.includes(req.file.mimetype)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid file type. Only images and PDFs are allowed',
      });
    }

    if (req.file.size > maxSizeBytes) {
      return res.status(400).json({
        success: false,
        message: 'File exceeds maximum size of 10MB',
      });
    }

    // Upload file to S3
    const key = buildS3Key('onboarding', req.file.originalname);
    await uploadFileToS3(req.file.buffer, key, req.file.mimetype);
    const fileUrl = key; // Store the S3 key as the file URL

    const submission = await OnboardingSubmission.create({
      requirementId,
      userId: req.userId,
      fileUrl,
      fileName: req.file.originalname,
      fileSize: req.file.size,
    });

    res.json({
      success: true,
      message: 'File submitted successfully',
      data: { submission },
    });
  } catch (error) {
    console.error('Submit file error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Delete submission - Admin only
exports.deleteSubmission = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (user.user_type !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can delete onboarding submissions',
      });
    }

    const { id } = req.params;
    const submission = await OnboardingSubmission.delete(id);

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found',
      });
    }

    res.json({
      success: true,
      message: 'Submission deleted successfully',
    });
  } catch (error) {
    console.error('Delete submission error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

