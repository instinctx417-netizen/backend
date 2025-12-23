const Notification = require('../models/Notification');
const { emitNotificationUpdate, emitUnreadCountUpdate } = require('../utils/socket');

/**
 * Get user notifications
 */
exports.getUserNotifications = async (req, res) => {
  try {
    const { unreadOnly, limit, page } = req.query;

    const pageNum = page ? parseInt(page, 10) || 1 : null;
    const limitNum = limit ? parseInt(limit, 10) || 10 : 10;

    const result = pageNum
      ? await Notification.findByUser(req.userId, {
          unreadOnly: unreadOnly === 'true',
          page: pageNum,
          limit: limitNum,
        })
      : await Notification.findByUser(req.userId, {
          unreadOnly: unreadOnly === 'true',
          limit: limitNum,
        });

    const notifications = pageNum ? result.data : result;
    const pagination = pageNum ? result.pagination : undefined;

    res.json({
      success: true,
      data: {
        notifications,
        ...(pagination ? { pagination } : {}),
      },
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Get unread count
 */
exports.getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.getUnreadCount(req.userId);

    res.json({
      success: true,
      data: { count },
    });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Create a new notification
 */
exports.create = async (req, res) => {
  try {
    const { userId, type, title, message, relatedEntityType, relatedEntityId } = req.body;

    // Verify user has permission (admin/HR can create notifications for others)
    const user = await require('../models/User').findById(req.userId);
    if (!user || !['admin', 'hr'].includes(user.user_type)) {
      return res.status(403).json({
        success: false,
        message: 'Only admins and HR can create notifications',
      });
    }

    const notification = await Notification.create({
      userId,
      type,
      title,
      message,
      relatedEntityType,
      relatedEntityId,
    });

    // Emit real-time event
    const io = req.app.get('io');
    if (io) {
      const { emitNotificationToUser, emitUnreadCountUpdate } = require('../utils/socket');
      emitNotificationToUser(io, userId, {
        id: notification.id,
        userId: notification.user_id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        relatedEntityType: notification.related_entity_type,
        relatedEntityId: notification.related_entity_id,
        read: notification.read || false,
        createdAt: notification.created_at,
      });

      const unreadCount = await Notification.getUnreadCount(userId);
      emitUnreadCountUpdate(io, userId, unreadCount);
    }

    res.status(201).json({
      success: true,
      message: 'Notification created',
      data: { notification },
    });
  } catch (error) {
    console.error('Create notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Mark notification as read
 */
exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const notification = await Notification.markAsRead(id, req.userId);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found',
      });
    }

    // Emit real-time update
    const io = req.app.get('io');
    if (io) {
      emitNotificationUpdate(io, req.userId, {
        id: parseInt(id),
        read: true,
      });

      const unreadCount = await Notification.getUnreadCount(req.userId);
      emitUnreadCountUpdate(io, req.userId, unreadCount);
    }

    res.json({
      success: true,
      message: 'Notification marked as read',
      data: { notification },
    });
  } catch (error) {
    console.error('Mark notification as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Mark all notifications as read
 */
exports.markAllAsRead = async (req, res) => {
  try {
    const notifications = await Notification.markAllAsRead(req.userId);

    // Emit real-time update
    const io = req.app.get('io');
    if (io) {
      // Emit update for each notification
      notifications.forEach((notif) => {
        emitNotificationUpdate(io, req.userId, {
          id: notif.id,
          read: true,
        });
      });

      const unreadCount = await Notification.getUnreadCount(req.userId);
      emitUnreadCountUpdate(io, req.userId, unreadCount);
    }

    res.json({
      success: true,
      message: 'All notifications marked as read',
      data: { count: notifications.length },
    });
  } catch (error) {
    console.error('Mark all notifications as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Mark notifications as read by related entity
 */
exports.markAsReadByRelatedEntity = async (req, res) => {
  try {
    const { relatedEntityType, relatedEntityId } = req.body;
    
    if (!relatedEntityType || !relatedEntityId) {
      return res.status(400).json({
        success: false,
        message: 'relatedEntityType and relatedEntityId are required',
      });
    }

    const notifications = await Notification.markAsReadByRelatedEntity(
      req.userId,
      relatedEntityType,
      relatedEntityId
    );

    // Emit real-time update
    const io = req.app.get('io');
    if (io) {
      // Emit update for each notification
      notifications.forEach((notif) => {
        emitNotificationUpdate(io, req.userId, {
          id: notif.id,
          read: true,
        });
      });

      const unreadCount = await Notification.getUnreadCount(req.userId);
      emitUnreadCountUpdate(io, req.userId, unreadCount);
    }

    res.json({
      success: true,
      message: 'Notifications marked as read',
      data: { count: notifications.length },
    });
  } catch (error) {
    console.error('Mark notifications as read by related entity error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};





