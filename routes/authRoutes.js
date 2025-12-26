const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/authMiddleware');
const { registerValidation, loginValidation } = require('../middleware/validation');

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post('/register', registerValidation, authController.register);

/**
 * @route   POST /api/auth/register-candidate
 * @desc    Register a candidate with file uploads (profile pic, resume, documents)
 * @access  Public
 */
router.post(
  '/register-candidate',
  authController.uploadCandidateFilesMiddleware,
  registerValidation,
  authController.registerCandidateWithFiles
);

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post('/login', loginValidation, authController.login);

/**
 * @route   GET /api/auth/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/profile', authenticate, authController.getProfile);

/**
 * @route   GET /api/auth/verify
 * @desc    Verify token and get user info
 * @access  Private
 */
router.get('/verify', authenticate, authController.verifyToken);

/**
 * @route   POST /api/auth/generate-community-token
 * @desc    Generate temporary token for community app access
 * @access  Private
 */
router.post('/generate-community-token', authenticate, authController.generateCommunityToken);

/**
 * @route   POST /api/auth/exchange-community-token
 * @desc    Exchange temporary code for JWT token
 * @access  Public
 */
router.post('/exchange-community-token', authController.exchangeCommunityToken);

module.exports = router;

