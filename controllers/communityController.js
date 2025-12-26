const CommunityPost = require('../models/CommunityPost');
const { buildS3Key, uploadFileToS3 } = require('../utils/s3');
const pool = require('../config/database');

// Helper to get S3 public URL
function getImageUrl(key) {
  if (!key) return null;
  
  // If it's already a full URL, return it
  if (key.startsWith('http://') || key.startsWith('https://')) {
    return key;
  }
  
  // Use public S3 base URL if configured
  const s3BaseUrl = process.env.S3_PUBLIC_BASE_URL || '';
  if (s3BaseUrl) {
    const base = s3BaseUrl.replace(/\/$/, '');
    return `${base}/${key}`;
  }
  
  // Fallback: return the key (frontend will handle it)
  return key;
}

// Get posts feed
exports.getPosts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const userId = req.userId;
    
    const result = await CommunityPost.findAll(page, limit, userId);
    
    // Generate public URLs for images
    const postsWithUrls = result.posts.map((post) => {
      if (post.imageUrl) {
        post.imageUrl = getImageUrl(post.imageUrl);
      }
      return post;
    });
    
    res.json({
      success: true,
      data: {
        posts: postsWithUrls,
        hasMore: result.hasMore,
      },
    });
  } catch (error) {
    console.error('Get posts error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Create a new post
exports.createPost = async (req, res) => {
  try {
    const { content } = req.body;
    const userId = req.userId;
    
    if (!content && !req.file) {
      return res.status(400).json({
        success: false,
        message: 'Post content or image is required',
      });
    }
    
    let imageUrl = null;
    
    // Upload image if provided
    if (req.file) {
      // Validate file size (max 10MB)
      if (req.file.size > 10 * 1024 * 1024) {
        return res.status(400).json({
          success: false,
          message: 'Image exceeds maximum size of 10MB',
        });
      }
      
      // Validate file type
      if (!req.file.mimetype.startsWith('image/')) {
        return res.status(400).json({
          success: false,
          message: 'File must be an image',
        });
      }
      
      // Upload to S3
      const key = buildS3Key('community-posts', req.file.originalname);
      await uploadFileToS3(req.file.buffer, key, req.file.mimetype);
      imageUrl = key;
    }
    
    const post = await CommunityPost.create({
      content: content || '',
      imageUrl,
      userId,
    });
    
    // Get full post with user info and counts
    const fullPost = await CommunityPost.findById(post.id, userId);
    
    // Generate public URL for image if exists
    if (fullPost.imageUrl) {
      fullPost.imageUrl = getImageUrl(fullPost.imageUrl);
    }
    
    res.json({
      success: true,
      message: 'Post created successfully',
      data: { post: fullPost },
    });
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Like/Unlike a post
exports.toggleLike = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    
    const result = await CommunityPost.toggleLike(parseInt(id), userId);
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Toggle like error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Get comments for a post
exports.getComments = async (req, res) => {
  try {
    const { id } = req.params;
    
    const comments = await CommunityPost.getComments(parseInt(id));
    
    res.json({
      success: true,
      data: { comments },
    });
  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Add a comment to a post
exports.addComment = async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const userId = req.userId;
    
    if (!content || !content.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Comment content is required',
      });
    }
    
    const comment = await CommunityPost.addComment(parseInt(id), userId, content.trim());
    
    res.json({
      success: true,
      message: 'Comment added successfully',
      data: { comment },
    });
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Share a post
exports.sharePost = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    
    const result = await CommunityPost.share(parseInt(id), userId);
    
    res.json({
      success: true,
      message: 'Post shared successfully',
      data: {
        sharesCount: result.sharesCount,
        sharedPostId: result.sharedPostId,
      },
    });
  } catch (error) {
    console.error('Share post error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Delete a post (only own posts)
exports.deletePost = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    
    await CommunityPost.deletePost(parseInt(id), userId);
    
    res.json({
      success: true,
      message: 'Post deleted successfully',
    });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(error.message?.includes('not found') ? 404 : error.message?.includes('only delete') ? 403 : 500).json({
      success: false,
      message: error.message || 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Delete a shared post (only from own wall)
exports.deleteSharedPost = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    
    const result = await CommunityPost.deleteSharedPost(parseInt(id), userId);
    
    res.json({
      success: true,
      message: 'Shared post removed successfully',
      data: result,
    });
  } catch (error) {
    console.error('Delete shared post error:', error);
    res.status(error.message?.includes('not found') || error.message?.includes('do not own') ? 404 : 500).json({
      success: false,
      message: error.message || 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Get user profile stats
exports.getUserProfile = async (req, res) => {
  try {
    const { userId } = req.params;
    const viewerId = req.userId;
    
    // Get user info
    const User = require('../models/User');
    const user = await User.findById(parseInt(userId));
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }
    
    // Get profile stats
    const stats = await CommunityPost.getUserProfileStats(parseInt(userId));
    
    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          firstName: user.first_name,
          lastName: user.last_name,
          profilePicPath: user.profile_pic_path,
        },
        ...stats,
      },
    });
  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Get user's posts (own posts + shared posts)
exports.getUserPosts = async (req, res) => {
  try {
    const { userId } = req.params;
    const viewerId = req.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    
    const posts = await CommunityPost.getUserPosts(parseInt(userId), viewerId, page, limit);
    
    // Generate public URLs for images
    const postsWithUrls = posts.map((post) => {
      if (post.imageUrl) {
        post.imageUrl = getImageUrl(post.imageUrl);
      }
      return post;
    });
    
    res.json({
      success: true,
      data: {
        posts: postsWithUrls,
      },
    });
  } catch (error) {
    console.error('Get user posts error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

