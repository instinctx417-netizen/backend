const pool = require('../config/database');

class CommunityPost {
  static async create(data) {
    const { content, imageUrl, userId } = data;
    const result = await pool.query(
      `INSERT INTO community_posts (content, image_url, user_id)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [content, imageUrl || null, userId]
    );
    const row = result.rows[0];
    // Convert timestamps to ISO format - PostgreSQL returns Date objects, convert to ISO string
    if (row.created_at) {
      const date = row.created_at instanceof Date ? row.created_at : new Date(row.created_at);
      row.created_at = date.toISOString();
    }
    if (row.updated_at) {
      const date = row.updated_at instanceof Date ? row.updated_at : new Date(row.updated_at);
      row.updated_at = date.toISOString();
    }
    return row;
  }

  static async findAll(page = 1, limit = 10, userId = null) {
    const offset = (page - 1) * limit;
    
    // Get posts with user info, like count, comment count, share count, and whether current user liked it
    // Include shared posts as separate entries (Facebook style)
    // For shared posts, get content/image from original post
    let query = `
      SELECT 
        p.id,
        COALESCE(p.content, orig_p.content) as content,
        COALESCE(p.image_url, orig_p.image_url) as image_url,
        p.user_id,
        p.shared_post_id,
        (p.created_at AT TIME ZONE 'UTC')::timestamptz as created_at,
        (p.updated_at AT TIME ZONE 'UTC')::timestamptz as updated_at,
        u.first_name,
        u.last_name,
        u.profile_pic_path,
        COUNT(DISTINCT l.id) as likes_count,
        COUNT(DISTINCT c.id) as comments_count,
        COUNT(DISTINCT s.id) as shares_count,
        CASE WHEN EXISTS (
          SELECT 1 FROM community_post_likes WHERE post_id = p.id AND user_id = $1
        ) THEN true ELSE false END as is_liked,
        CASE WHEN EXISTS (
          SELECT 1 FROM community_post_shares WHERE post_id = COALESCE(p.shared_post_id, p.id) AND user_id = $1
        ) THEN true ELSE false END as is_shared,
        -- Original post info if this is a shared post
        orig_p.user_id as original_user_id,
        orig_p.created_at as original_created_at,
        orig_u.first_name as original_first_name,
        orig_u.last_name as original_last_name,
        orig_u.profile_pic_path as original_profile_pic_path
      FROM community_posts p
      INNER JOIN users u ON p.user_id = u.id
      LEFT JOIN community_posts orig_p ON p.shared_post_id = orig_p.id
      LEFT JOIN users orig_u ON orig_p.user_id = orig_u.id
      LEFT JOIN community_post_likes l ON p.id = l.post_id
      LEFT JOIN community_post_comments c ON p.id = c.post_id
      LEFT JOIN community_post_shares s ON COALESCE(p.shared_post_id, p.id) = s.post_id
      GROUP BY p.id, p.content, p.image_url, p.user_id, p.shared_post_id, p.created_at, p.updated_at, u.first_name, u.last_name, u.profile_pic_path, orig_p.user_id, orig_p.content, orig_p.image_url, orig_p.created_at, orig_u.first_name, orig_u.last_name, orig_u.profile_pic_path
      ORDER BY p.created_at DESC
      LIMIT $2 OFFSET $3
    `;
    
    const result = await pool.query(query, [userId || 0, limit, offset]);
    
    // Get total count for pagination
    const countResult = await pool.query('SELECT COUNT(*) FROM community_posts');
    const total = parseInt(countResult.rows[0].count);
    const hasMore = offset + limit < total;
    
    return {
      posts: result.rows.map(row => {
        const isSharedPost = !!row.shared_post_id;
        return {
          id: row.id,
          content: row.content, // This is now from original post if shared
          imageUrl: row.image_url, // This is now from original post if shared
          userId: row.user_id,
          sharedPostId: row.shared_post_id || undefined,
          user: {
            id: row.user_id,
            firstName: row.first_name,
            lastName: row.last_name,
            profilePicPath: row.profile_pic_path,
          },
          originalUser: isSharedPost && row.original_user_id ? {
            id: row.original_user_id,
            firstName: row.original_first_name,
            lastName: row.original_last_name,
            profilePicPath: row.original_profile_pic_path,
          } : undefined,
          originalCreatedAt: isSharedPost && row.original_created_at ? (row.original_created_at instanceof Date ? row.original_created_at.toISOString() : new Date(row.original_created_at).toISOString()) : undefined,
          likesCount: parseInt(row.likes_count) || 0,
          commentsCount: parseInt(row.comments_count) || 0,
          sharesCount: parseInt(row.shares_count) || 0,
          isLiked: row.is_liked,
          isShared: isSharedPost,
          sharedBy: isSharedPost ? {
            id: row.user_id,
            firstName: row.first_name,
            lastName: row.last_name,
            profilePicPath: row.profile_pic_path,
          } : undefined,
          createdAt: row.created_at ? (row.created_at instanceof Date ? row.created_at.toISOString() : new Date(row.created_at).toISOString()) : null,
          updatedAt: row.updated_at ? (row.updated_at instanceof Date ? row.updated_at.toISOString() : new Date(row.updated_at).toISOString()) : null,
        };
      }),
      hasMore,
    };
  }

  static async findById(id, userId = null) {
    const result = await pool.query(
      `SELECT 
        p.id,
        COALESCE(p.content, orig_p.content) as content,
        COALESCE(p.image_url, orig_p.image_url) as image_url,
        p.user_id,
        p.shared_post_id,
        (p.created_at AT TIME ZONE 'UTC')::timestamptz as created_at,
        (p.updated_at AT TIME ZONE 'UTC')::timestamptz as updated_at,
        u.first_name,
        u.last_name,
        u.profile_pic_path,
        COUNT(DISTINCT l.id) as likes_count,
        COUNT(DISTINCT c.id) as comments_count,
        COUNT(DISTINCT s.id) as shares_count,
        CASE WHEN EXISTS (
          SELECT 1 FROM community_post_likes WHERE post_id = p.id AND user_id = $2
        ) THEN true ELSE false END as is_liked,
        CASE WHEN EXISTS (
          SELECT 1 FROM community_post_shares WHERE post_id = COALESCE(p.shared_post_id, p.id) AND user_id = $2
        ) THEN true ELSE false END as is_shared,
        -- Original post info if this is a shared post
        orig_p.user_id as original_user_id,
        orig_p.created_at as original_created_at,
        orig_u.first_name as original_first_name,
        orig_u.last_name as original_last_name,
        orig_u.profile_pic_path as original_profile_pic_path
      FROM community_posts p
      INNER JOIN users u ON p.user_id = u.id
      LEFT JOIN community_posts orig_p ON p.shared_post_id = orig_p.id
      LEFT JOIN users orig_u ON orig_p.user_id = orig_u.id
      LEFT JOIN community_post_likes l ON p.id = l.post_id
      LEFT JOIN community_post_comments c ON p.id = c.post_id
      LEFT JOIN community_post_shares s ON COALESCE(p.shared_post_id, p.id) = s.post_id
      WHERE p.id = $1
      GROUP BY p.id, p.content, p.image_url, p.user_id, p.shared_post_id, p.created_at, p.updated_at, u.first_name, u.last_name, u.profile_pic_path, orig_p.user_id, orig_p.content, orig_p.image_url, orig_p.created_at, orig_u.first_name, orig_u.last_name, orig_u.profile_pic_path`,
      [id, userId || 0]
    );
    
    if (result.rows.length === 0) return null;
    
    const row = result.rows[0];
    const isSharedPost = !!row.shared_post_id;
    return {
      id: row.id,
      content: row.content,
      imageUrl: row.image_url,
      userId: row.user_id,
      sharedPostId: row.shared_post_id || undefined,
      user: {
        id: row.user_id,
        firstName: row.first_name,
        lastName: row.last_name,
        profilePicPath: row.profile_pic_path,
      },
        originalUser: isSharedPost && row.original_user_id ? {
          id: row.original_user_id,
          firstName: row.original_first_name,
          lastName: row.original_last_name,
          profilePicPath: row.original_profile_pic_path,
        } : undefined,
        originalCreatedAt: isSharedPost && row.original_created_at ? (row.original_created_at instanceof Date ? row.original_created_at.toISOString() : new Date(row.original_created_at).toISOString()) : undefined,
        likesCount: parseInt(row.likes_count) || 0,
      commentsCount: parseInt(row.comments_count) || 0,
      sharesCount: parseInt(row.shares_count) || 0,
      isLiked: row.is_liked,
      isShared: isSharedPost,
      sharedBy: isSharedPost ? {
        id: row.user_id,
        firstName: row.first_name,
        lastName: row.last_name,
        profilePicPath: row.profile_pic_path,
      } : undefined,
      createdAt: row.created_at ? (row.created_at instanceof Date ? row.created_at.toISOString() : new Date(row.created_at).toISOString()) : null,
      updatedAt: row.updated_at ? (row.updated_at instanceof Date ? row.updated_at.toISOString() : new Date(row.updated_at).toISOString()) : null,
    };
  }

  static async toggleLike(postId, userId) {
    // Check if like exists
    const checkResult = await pool.query(
      'SELECT id FROM community_post_likes WHERE post_id = $1 AND user_id = $2',
      [postId, userId]
    );
    
    if (checkResult.rows.length > 0) {
      // Unlike
      await pool.query(
        'DELETE FROM community_post_likes WHERE post_id = $1 AND user_id = $2',
        [postId, userId]
      );
    } else {
      // Like
      await pool.query(
        'INSERT INTO community_post_likes (post_id, user_id) VALUES ($1, $2)',
        [postId, userId]
      );
    }
    
    // Get updated like count
    const countResult = await pool.query(
      'SELECT COUNT(*) as count FROM community_post_likes WHERE post_id = $1',
      [postId]
    );
    
    // Check if user liked it now
    const isLikedResult = await pool.query(
      'SELECT EXISTS(SELECT 1 FROM community_post_likes WHERE post_id = $1 AND user_id = $2) as is_liked',
      [postId, userId]
    );
    
    return {
      isLiked: isLikedResult.rows[0].is_liked,
      likesCount: parseInt(countResult.rows[0].count),
    };
  }

  static async addComment(postId, userId, content) {
    const result = await pool.query(
      `INSERT INTO community_post_comments (post_id, user_id, content)
       VALUES ($1, $2, $3)
       RETURNING id, content, post_id, user_id, (created_at AT TIME ZONE 'UTC')::timestamptz as created_at, (updated_at AT TIME ZONE 'UTC')::timestamptz as updated_at`,
      [postId, userId, content]
    );
    
    // Get user info
    const userResult = await pool.query(
      'SELECT id, first_name, last_name, profile_pic_path FROM users WHERE id = $1',
      [userId]
    );
    
    const comment = result.rows[0];
    const user = userResult.rows[0];
    
    return {
      id: comment.id,
      content: comment.content,
      postId: comment.post_id,
      userId: comment.user_id,
      user: {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        profilePicPath: user.profile_pic_path,
      },
      createdAt: comment.created_at ? (comment.created_at instanceof Date ? comment.created_at.toISOString() : new Date(comment.created_at).toISOString()) : null,
      updatedAt: comment.updated_at ? (comment.updated_at instanceof Date ? comment.updated_at.toISOString() : new Date(comment.updated_at).toISOString()) : null,
    };
  }

  static async getComments(postId) {
    const result = await pool.query(
      `SELECT 
        c.id,
        c.content,
        c.post_id,
        c.user_id,
        (c.created_at AT TIME ZONE 'UTC')::timestamptz as created_at,
        (c.updated_at AT TIME ZONE 'UTC')::timestamptz as updated_at,
        u.first_name,
        u.last_name,
        u.profile_pic_path
      FROM community_post_comments c
      INNER JOIN users u ON c.user_id = u.id
      WHERE c.post_id = $1
      ORDER BY c.created_at ASC`,
      [postId]
    );
    
    return result.rows.map(row => ({
      id: row.id,
      content: row.content,
      postId: row.post_id,
      userId: row.user_id,
      user: {
        id: row.user_id,
        firstName: row.first_name,
        lastName: row.last_name,
        profilePicPath: row.profile_pic_path,
      },
      createdAt: row.created_at ? (row.created_at instanceof Date ? row.created_at.toISOString() : new Date(row.created_at + (row.created_at.includes('Z') || row.created_at.includes('+') ? '' : 'Z')).toISOString()) : null,
      updatedAt: row.updated_at ? (row.updated_at instanceof Date ? row.updated_at.toISOString() : new Date(row.updated_at + (row.updated_at.includes('Z') || row.updated_at.includes('+') ? '' : 'Z')).toISOString()) : null,
    }));
  }

  static async share(postId, userId) {
    // Get the post to check if it's a shared post
    const postResult = await pool.query(
      'SELECT id, shared_post_id FROM community_posts WHERE id = $1',
      [postId]
    );
    
    if (postResult.rows.length === 0) {
      throw new Error('Post not found');
    }
    
    // Always share the original post (if this is a shared post, get the original)
    const originalPostId = postResult.rows[0].shared_post_id || postResult.rows[0].id;
    
    // Verify original post exists
    const originalPost = await pool.query(
      'SELECT id FROM community_posts WHERE id = $1',
      [originalPostId]
    );
    
    if (originalPost.rows.length === 0) {
      throw new Error('Original post not found');
    }
    
    // Always create a new post entry for each share (Facebook style - allows multiple shares)
    // Content and image_url are null - we'll fetch from original post when displaying
    const newPostResult = await pool.query(
      `INSERT INTO community_posts (content, image_url, user_id, shared_post_id)
       VALUES (NULL, NULL, $1, $2)
       RETURNING id, created_at`,
      [userId, originalPostId]
    );
    
    // Add share record (for tracking share count on original post)
    // Note: We allow multiple shares by same user, so no UNIQUE constraint check
    await pool.query(
      'INSERT INTO community_post_shares (post_id, user_id) VALUES ($1, $2)',
      [originalPostId, userId]
    );
    
    // Get updated share count (total number of times the original post has been shared)
    const countResult = await pool.query(
      'SELECT COUNT(*) as count FROM community_post_shares WHERE post_id = $1',
      [originalPostId]
    );
    
    return {
      sharesCount: parseInt(countResult.rows[0].count),
      isShared: true,
      sharedPostId: newPostResult.rows[0].id,
    };
  }

  static async isShared(postId, userId) {
    const result = await pool.query(
      'SELECT EXISTS(SELECT 1 FROM community_post_shares WHERE post_id = $1 AND user_id = $2) as is_shared',
      [postId, userId]
    );
    return result.rows[0].is_shared;
  }

  static async deletePost(postId, userId) {
    // Check if post belongs to user
    const checkResult = await pool.query(
      'SELECT user_id FROM community_posts WHERE id = $1',
      [postId]
    );
    
    if (checkResult.rows.length === 0) {
      throw new Error('Post not found');
    }
    
    if (checkResult.rows[0].user_id !== userId) {
      throw new Error('You can only delete your own posts');
    }
    
    // Delete the post (cascade will delete likes, comments, shares)
    await pool.query('DELETE FROM community_posts WHERE id = $1', [postId]);
    return true;
  }

  static async deleteSharedPost(sharedPostId, userId) {
    // Check if this is a shared post owned by the user
    const checkResult = await pool.query(
      'SELECT id, shared_post_id FROM community_posts WHERE id = $1 AND user_id = $2 AND shared_post_id IS NOT NULL',
      [sharedPostId, userId]
    );
    
    if (checkResult.rows.length === 0) {
      throw new Error('Shared post not found or you do not own it');
    }
    
    const originalPostId = checkResult.rows[0].shared_post_id;
    
    // Delete the shared post entry
    await pool.query('DELETE FROM community_posts WHERE id = $1', [sharedPostId]);
    
    // Delete the share record
    await pool.query(
      'DELETE FROM community_post_shares WHERE post_id = $1 AND user_id = $2',
      [originalPostId, userId]
    );
    
    // Get updated share count for original post
    const countResult = await pool.query(
      'SELECT COUNT(*) as count FROM community_post_shares WHERE post_id = $1',
      [originalPostId]
    );
    
    return {
      sharesCount: parseInt(countResult.rows[0].count),
    };
  }

  static async getUserProfileStats(userId) {
    // Get own posts count
    const ownPostsResult = await pool.query(
      'SELECT COUNT(*) as count FROM community_posts WHERE user_id = $1',
      [userId]
    );
    
    // Get shared posts count (posts shared by this user)
    const sharedPostsResult = await pool.query(
      'SELECT COUNT(*) as count FROM community_post_shares WHERE user_id = $1',
      [userId]
    );
    
    return {
      ownPostsCount: parseInt(ownPostsResult.rows[0].count),
      sharedPostsCount: parseInt(sharedPostsResult.rows[0].count),
    };
  }

  static async getUserPosts(userId, viewerId = null, page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    
    // Get user's own posts (excluding shared posts)
    const ownPostsQuery = `
      SELECT 
        p.id,
        p.content,
        p.image_url,
        p.user_id,
        p.shared_post_id,
        (p.created_at AT TIME ZONE 'UTC')::timestamptz as created_at,
        (p.updated_at AT TIME ZONE 'UTC')::timestamptz as updated_at,
        u.first_name,
        u.last_name,
        u.profile_pic_path,
        COUNT(DISTINCT l.id) as likes_count,
        COUNT(DISTINCT c.id) as comments_count,
        COUNT(DISTINCT s.id) as shares_count,
        CASE WHEN EXISTS (
          SELECT 1 FROM community_post_likes WHERE post_id = p.id AND user_id = $2
        ) THEN true ELSE false END as is_liked,
        false as is_shared_post
      FROM community_posts p
      INNER JOIN users u ON p.user_id = u.id
      LEFT JOIN community_post_likes l ON p.id = l.post_id
      LEFT JOIN community_post_comments c ON p.id = c.post_id
      LEFT JOIN community_post_shares s ON p.id = s.post_id
      WHERE p.user_id = $1 AND p.shared_post_id IS NULL
      GROUP BY p.id, p.content, p.image_url, p.user_id, p.shared_post_id, p.created_at, p.updated_at, u.first_name, u.last_name, u.profile_pic_path
      ORDER BY p.created_at DESC
      LIMIT $3 OFFSET $4
    `;
    
    const ownPostsResult = await pool.query(ownPostsQuery, [userId, viewerId || 0, limit, offset]);
    
    // Get shared posts (posts shared by this user - these are new post entries with shared_post_id)
    const sharedPostsQuery = `
      SELECT 
        p.id,
        COALESCE(p.content, orig_p.content) as content,
        COALESCE(p.image_url, orig_p.image_url) as image_url,
        p.user_id,
        p.shared_post_id,
        (p.created_at AT TIME ZONE 'UTC')::timestamptz as created_at,
        (p.updated_at AT TIME ZONE 'UTC')::timestamptz as updated_at,
        u.first_name,
        u.last_name,
        u.profile_pic_path,
        COUNT(DISTINCT l.id) as likes_count,
        COUNT(DISTINCT c.id) as comments_count,
        COUNT(DISTINCT s.id) as shares_count,
        CASE WHEN EXISTS (
          SELECT 1 FROM community_post_likes WHERE post_id = p.id AND user_id = $2
        ) THEN true ELSE false END as is_liked,
        true as is_shared_post,
        orig_p.user_id as original_user_id,
        orig_p.created_at as original_created_at,
        orig_u.first_name as original_first_name,
        orig_u.last_name as original_last_name,
        orig_u.profile_pic_path as original_profile_pic_path
      FROM community_posts p
      INNER JOIN users u ON p.user_id = u.id
      LEFT JOIN community_posts orig_p ON p.shared_post_id = orig_p.id
      LEFT JOIN users orig_u ON orig_p.user_id = orig_u.id
      LEFT JOIN community_post_likes l ON p.id = l.post_id
      LEFT JOIN community_post_comments c ON p.id = c.post_id
      LEFT JOIN community_post_shares s ON COALESCE(p.shared_post_id, p.id) = s.post_id
      WHERE p.user_id = $1 AND p.shared_post_id IS NOT NULL
      GROUP BY p.id, p.content, p.image_url, p.user_id, p.shared_post_id, p.created_at, p.updated_at, u.first_name, u.last_name, u.profile_pic_path, orig_p.user_id, orig_p.content, orig_p.image_url, orig_p.created_at, orig_u.first_name, orig_u.last_name, orig_u.profile_pic_path
      ORDER BY p.created_at DESC
      LIMIT $3 OFFSET $4
    `;
    
    const sharedPostsResult = await pool.query(sharedPostsQuery, [userId, viewerId || 0, limit, offset]);
    
    // Combine and sort by created_at
    const allPosts = [
      ...ownPostsResult.rows.map(row => ({
        ...row,
        isShared: false,
        sharedPostId: null,
      })),
      ...sharedPostsResult.rows.map(row => ({
        ...row,
        isShared: true,
        sharedPostId: row.shared_post_id,
      })),
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
    // Format posts
    const formattedPosts = allPosts.map(row => {
      const isSharedPost = row.isShared;
      return {
        id: row.id,
        content: row.content,
        imageUrl: row.image_url,
        userId: row.user_id,
        sharedPostId: row.sharedPostId || undefined,
        user: {
          id: row.user_id,
          firstName: row.first_name,
          lastName: row.last_name,
          profilePicPath: row.profile_pic_path,
        },
        originalUser: isSharedPost && row.original_user_id ? {
          id: row.original_user_id,
          firstName: row.original_first_name,
          lastName: row.original_last_name,
          profilePicPath: row.original_profile_pic_path,
        } : undefined,
        originalCreatedAt: isSharedPost && row.original_created_at ? (row.original_created_at instanceof Date ? row.original_created_at.toISOString() : new Date(row.original_created_at).toISOString()) : undefined,
        likesCount: parseInt(row.likes_count) || 0,
        commentsCount: parseInt(row.comments_count) || 0,
        sharesCount: parseInt(row.shares_count) || 0,
        isLiked: row.is_liked,
        isShared: isSharedPost,
        sharedBy: isSharedPost ? {
          id: row.user_id,
          firstName: row.first_name,
          lastName: row.last_name,
          profilePicPath: row.profile_pic_path,
        } : undefined,
        createdAt: row.created_at ? (row.created_at instanceof Date ? row.created_at.toISOString() : new Date(row.created_at).toISOString()) : null,
        updatedAt: row.updated_at ? (row.updated_at instanceof Date ? row.updated_at.toISOString() : new Date(row.updated_at).toISOString()) : null,
      };
    });
    
    return formattedPosts;
  }
}

module.exports = CommunityPost;

