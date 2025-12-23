const pool = require('../config/database');

class TicketMessage {
  /**
   * Create a new ticket message
   */
  static async create(messageData) {
    const {
      ticketId,
      sentByUserId,
      message
    } = messageData;

    const query = `
      INSERT INTO ticket_messages (
        ticket_id, sent_by_user_id, message, created_at
      )
      VALUES ($1, $2, $3, NOW())
      RETURNING *
    `;

    const result = await pool.query(query, [
      ticketId,
      sentByUserId,
      message
    ]);

    return result.rows[0];
  }

  /**
   * Find messages by ticket ID
   */
  static async findByTicket(ticketId) {
    const query = `
      SELECT 
        tm.*,
        u.id as user_id,
        u.email as user_email,
        u.first_name as user_first_name,
        u.last_name as user_last_name,
        u.full_name as user_full_name,
        u.user_type as user_type
      FROM ticket_messages tm
      JOIN users u ON u.id = tm.sent_by_user_id
      WHERE tm.ticket_id = $1
      ORDER BY tm.created_at ASC
    `;
    const result = await pool.query(query, [ticketId]);
    return result.rows;
  }
}

module.exports = TicketMessage;

