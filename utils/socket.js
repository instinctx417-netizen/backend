/**
 * Socket.io utility for emitting notifications
 * Use this in controllers to send real-time notifications
 */

/**
 * Emit a notification to a specific user
 * @param {Object} io - Socket.io instance (from app.get('io'))
 * @param {number} userId - Target user ID
 * @param {Object} notification - Notification object
 */
function emitNotificationToUser(io, userId, notification) {
  if (!io) {
    console.warn('Socket.io instance not available');
    return;
  }

  io.to(`user-${userId}`).emit('new-notification', notification);
  console.log(`Notification emitted to user ${userId}:`, notification.title);
}

/**
 * Emit notification update (e.g., when marked as read)
 * @param {Object} io - Socket.io instance
 * @param {number} userId - Target user ID
 * @param {Object} update - Update data
 */
function emitNotificationUpdate(io, userId, update) {
  if (!io) {
    console.warn('Socket.io instance not available');
    return;
  }

  io.to(`user-${userId}`).emit('notification-updated', update);
}

/**
 * Emit unread count update
 * @param {Object} io - Socket.io instance
 * @param {number} userId - Target user ID
 * @param {number} count - New unread count
 */
function emitUnreadCountUpdate(io, userId, count) {
  if (!io) {
    console.warn('Socket.io instance not available');
    return;
  }

  io.to(`user-${userId}`).emit('unread-count-updated', { count });
}

module.exports = {
  emitNotificationToUser,
  emitNotificationUpdate,
  emitUnreadCountUpdate,
};

