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
   * Find notifications by user with optional pagination
   */
  static async findByUser(userId, options = {}) {
    let query = 'SELECT * FROM notifications WHERE user_id = $1';
    const params = [userId];
    let paramCount = 1;

    if (options.unreadOnly) {
      query += ' AND read = false';
    }

    const page = options.page && options.page > 0 ? options.page : null;
    const limit = options.limit && options.limit > 0 ? options.limit : null;
    let totalCount = null;

    // Get total count if pagination is requested
    if (page && limit) {
      let countQuery = 'SELECT COUNT(*) FROM notifications WHERE user_id = $1';
      const countParams = [userId];
      
      if (options.unreadOnly) {
        countQuery += ' AND read = false';
      }
      
      const countResult = await pool.query(countQuery, countParams);
      totalCount = parseInt(countResult.rows[0].count, 10) || 0;
    }

    query += ' ORDER BY created_at DESC';

    if (page && limit) {
      const offset = (page - 1) * limit;
      paramCount++;
      query += ` LIMIT $${paramCount}`;
      params.push(limit);
      paramCount++;
      query += ` OFFSET $${paramCount}`;
      params.push(offset);
    } else if (options.limit) {
      paramCount++;
      query += ` LIMIT $${paramCount}`;
      params.push(options.limit);
    }

    const result = await pool.query(query, params);

    if (page && limit) {
      const totalPages = totalCount ? Math.ceil(totalCount / limit) : 1;
      return {
        data: result.rows,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    }

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
   * Mark notifications as read by related entity
   */
  static async markAsReadByRelatedEntity(userId, relatedEntityType, relatedEntityId) {
    const query = `
      UPDATE notifications 
      SET read = true, read_at = NOW()
      WHERE user_id = $1 
        AND related_entity_type = $2 
        AND related_entity_id = $3 
        AND read = false
      RETURNING id
    `;
    const result = await pool.query(query, [userId, relatedEntityType, relatedEntityId]);
    return result.rows;
  }

  /**
   * Get unread count per ticket for a user
   */
  static async getUnreadCountsByTickets(userId, ticketIds) {
    if (!ticketIds || ticketIds.length === 0) {
      return {};
    }

    const placeholders = ticketIds.map((_, index) => `$${index + 2}`).join(', ');
    const query = `
      SELECT 
        related_entity_id as ticket_id,
        COUNT(*) as count
      FROM notifications
      WHERE user_id = $1
        AND related_entity_type = 'ticket'
        AND related_entity_id IN (${placeholders})
        AND read = false
      GROUP BY related_entity_id
    `;
    
    const result = await pool.query(query, [userId, ...ticketIds]);
    
    // Convert to object with ticket ID as key
    const counts = {};
    result.rows.forEach(row => {
      counts[row.ticket_id] = parseInt(row.count, 10);
    });
    
    return counts;
  }

}

module.exports = Notification;




