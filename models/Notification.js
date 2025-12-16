const pool = require('../config/database');

class Notification {
  /**
   * Create a new notification
   */
  static async create(notificationData) {
    const {
      userId,
      type,
      title,
      message,
      relatedEntityType,
      relatedEntityId
    } = notificationData;

    const query = `
      INSERT INTO notifications (
        user_id, type, title, message,
        related_entity_type, related_entity_id, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      RETURNING *
    `;

    const result = await pool.query(query, [
      userId,
      type,
      title,
      message,
      relatedEntityType || null,
      relatedEntityId || null
    ]);

    return result.rows[0];
  }

  /**
   * Bulk create notifications
   */
  static async bulkCreate(notifications) {
    if (!notifications || notifications.length === 0) return [];

    const values = [];
    const placeholders = [];
    let paramCount = 0;

    notifications.forEach((notif) => {
      const params = [
        notif.userId,
        notif.type,
        notif.title,
        notif.message,
        notif.relatedEntityType || null,
        notif.relatedEntityId || null
      ];

      const ph = params.map((_, i) => `$${paramCount + i + 1}`).join(', ');
      placeholders.push(`(${ph})`);
      values.push(...params);
      paramCount += params.length;
    });

    const query = `
      INSERT INTO notifications (
        user_id, type, title, message,
        related_entity_type, related_entity_id
      )
      VALUES ${placeholders.join(', ')}
      RETURNING *
    `;

    const result = await pool.query(query, values);
    return result.rows;
  }

  /**
   * Find notifications by user
   */
  static async findByUser(userId, options = {}) {
    let query = 'SELECT * FROM notifications WHERE user_id = $1';
    const params = [userId];
    let paramCount = 1;

    if (options.unreadOnly) {
      query += ' AND read = false';
    }

    query += ' ORDER BY created_at DESC';

    if (options.limit) {
      paramCount++;
      query += ` LIMIT $${paramCount}`;
      params.push(options.limit);
    }

    const result = await pool.query(query, params);
    return result.rows;
  }

  /**
   * Mark notification as read
   */
  static async markAsRead(id, userId) {
    const query = `
      UPDATE notifications 
      SET read = true, read_at = NOW()
      WHERE id = $1 AND user_id = $2
      RETURNING *
    `;
    const result = await pool.query(query, [id, userId]);
    return result.rows[0];
  }

  /**
   * Mark all notifications as read for user
   */
  static async markAllAsRead(userId) {
    const query = `
      UPDATE notifications 
      SET read = true, read_at = NOW()
      WHERE user_id = $1 AND read = false
      RETURNING id
    `;
    const result = await pool.query(query, [userId]);
    return result.rows;
  }

  /**
   * Get unread count for user
   */
  static async getUnreadCount(userId) {
    const query = `
      SELECT COUNT(*) as count
      FROM notifications
      WHERE user_id = $1 AND read = false
    `;
    const result = await pool.query(query, [userId]);
    return parseInt(result.rows[0].count);
  }

  /**
   * Delete notification
   */
  static async delete(id, userId) {
    const query = `
      DELETE FROM notifications 
      WHERE id = $1 AND user_id = $2
      RETURNING id
    `;
    const result = await pool.query(query, [id, userId]);
    return result.rows[0];
  }
}

module.exports = Notification;




