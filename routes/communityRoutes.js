const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware');
const communityController = require('../controllers/communityController');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

// All routes require authentication
router.use(authenticate);

// Community routes
router.get('/posts', communityController.getPosts);
router.post('/posts', upload.single('image'), communityController.createPost);
router.delete('/posts/:id', communityController.deletePost);
router.post('/posts/:id/like', communityController.toggleLike);
router.get('/posts/:id/comments', communityController.getComments);
router.post('/posts/:id/comments', communityController.addComment);
router.post('/posts/:id/share', communityController.sharePost);
router.delete('/posts/:id/share', communityController.deleteSharedPost);

// Profile routes
router.get('/profile/:userId', communityController.getUserProfile);
router.get('/profile/:userId/posts', communityController.getUserPosts);

module.exports = router;

