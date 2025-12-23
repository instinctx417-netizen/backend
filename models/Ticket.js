const pool = require('../config/database');

class Ticket {
  /**
   * Create a new ticket
   */
  static async create(ticketData) {
    const {
      createdByUserId,
      ticketType,
      subject,
      description
    } = ticketData;

    const query = `
      INSERT INTO tickets (
        created_by_user_id, ticket_type, subject, description,
        status, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, 'open', NOW(), NOW())
      RETURNING *
    `;

    const result = await pool.query(query, [
      createdByUserId,
      ticketType,
      subject || null,
      description
    ]);

    return result.rows[0];
  }

  /**
   * Find ticket by ID with user details
   */
  static async findById(id) {
    const query = `
      SELECT 
        t.*,
        creator.id as creator_user_id,
        creator.email as creator_email,
        creator.first_name as creator_first_name,
        creator.last_name as creator_last_name,
        creator.full_name as creator_full_name,
        assignee.id as assignee_user_id,
        assignee.email as assignee_email,
        assignee.first_name as assignee_first_name,
        assignee.last_name as assignee_last_name,
        assignee.full_name as assignee_full_name
      FROM tickets t
      LEFT JOIN users creator ON creator.id = t.created_by_user_id
      LEFT JOIN users assignee ON assignee.id = t.assigned_to_user_id
      WHERE t.id = $1
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  /**
   * Find tickets by creator user ID
   */
  static async findByCreator(userId, options = {}) {
    let query = `
      SELECT 
        t.*,
        assignee.first_name as assignee_first_name,
        assignee.last_name as assignee_last_name,
        assignee.full_name as assignee_full_name
      FROM tickets t
      LEFT JOIN users assignee ON assignee.id = t.assigned_to_user_id
      WHERE t.created_by_user_id = $1
    `;
    const params = [userId];

    if (options.status) {
      query += ` AND t.status = $${params.length + 1}`;
      params.push(options.status);
    }

    query += ' ORDER BY t.created_at DESC';

    const page = options.page && options.page > 0 ? options.page : null;
    const limit = options.limit && options.limit > 0 ? options.limit : null;
    let totalCount = null;

    if (page && limit) {
      // Build count query separately
      let countQuery = `
        SELECT COUNT(*) as count
        FROM tickets t
        LEFT JOIN users assignee ON assignee.id = t.assigned_to_user_id
        WHERE t.created_by_user_id = $1
      `;
      const countParams = [userId];
      
      if (options.status) {
        countQuery += ` AND t.status = $${countParams.length + 1}`;
        countParams.push(options.status);
      }
      
      const countResult = await pool.query(countQuery, countParams);
      totalCount = parseInt(countResult.rows[0].count, 10) || 0;

      const offset = (page - 1) * limit;
      query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limit, offset);
    }

    const result = await pool.query(query, params);
    const tickets = result.rows;

    let pagination = undefined;
    if (page && limit && totalCount !== null) {
      const totalPages = Math.ceil(totalCount / limit);
      pagination = {
        page,
        limit,
        totalCount,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      };
    }

    return page && limit ? { data: tickets, pagination } : tickets;
  }

  /**
   * Find tickets assigned to user
   */
  static async findByAssigned(userId, options = {}) {
    let query = `
      SELECT 
        t.*,
        creator.first_name as creator_first_name,
        creator.last_name as creator_last_name,
        creator.full_name as creator_full_name
      FROM tickets t
      LEFT JOIN users creator ON creator.id = t.created_by_user_id
      WHERE t.assigned_to_user_id = $1
    `;
    const params = [userId];

    if (options.status) {
      query += ` AND t.status = $${params.length + 1}`;
      params.push(options.status);
    }

    query += ' ORDER BY t.created_at DESC';

    const page = options.page && options.page > 0 ? options.page : null;
    const limit = options.limit && options.limit > 0 ? options.limit : null;
    let totalCount = null;

    if (page && limit) {
      // Build count query separately
      let countQuery = `
        SELECT COUNT(*) as count
        FROM tickets t
        LEFT JOIN users creator ON creator.id = t.created_by_user_id
        WHERE t.assigned_to_user_id = $1
      `;
      const countParams = [userId];
      
      if (options.status) {
        countQuery += ` AND t.status = $${countParams.length + 1}`;
        countParams.push(options.status);
      }
      
      const countResult = await pool.query(countQuery, countParams);
      totalCount = parseInt(countResult.rows[0].count, 10) || 0;

      const offset = (page - 1) * limit;
      query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limit, offset);
    }

    const result = await pool.query(query, params);
    const tickets = result.rows;

    let pagination = undefined;
    if (page && limit && totalCount !== null) {
      const totalPages = Math.ceil(totalCount / limit);
      pagination = {
        page,
        limit,
        totalCount,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      };
    }

    return page && limit ? { data: tickets, pagination } : tickets;
  }

  /**
   * Find all tickets (for admin)
   */
  static async findAll(options = {}) {
    let query = `
      SELECT 
        t.*,
        creator.first_name as creator_first_name,
        creator.last_name as creator_last_name,
        creator.full_name as creator_full_name,
        assignee.first_name as assignee_first_name,
        assignee.last_name as assignee_last_name,
        assignee.full_name as assignee_full_name
      FROM tickets t
      LEFT JOIN users creator ON creator.id = t.created_by_user_id
      LEFT JOIN users assignee ON assignee.id = t.assigned_to_user_id
      WHERE 1=1
    `;
    const params = [];

    if (options.status) {
      query += ` AND t.status = $${params.length + 1}`;
      params.push(options.status);
    }

    if (options.ticketType) {
      query += ` AND t.ticket_type = $${params.length + 1}`;
      params.push(options.ticketType);
    }

    query += ' ORDER BY t.created_at DESC';

    const page = options.page && options.page > 0 ? options.page : null;
    const limit = options.limit && options.limit > 0 ? options.limit : null;
    let totalCount = null;

    if (page && limit) {
      // Build count query separately
      let countQuery = `
        SELECT COUNT(*) as count
        FROM tickets t
        LEFT JOIN users creator ON creator.id = t.created_by_user_id
        LEFT JOIN users assignee ON assignee.id = t.assigned_to_user_id
        WHERE 1=1
      `;
      const countParams = [];
      
      if (options.status) {
        countQuery += ` AND t.status = $${countParams.length + 1}`;
        countParams.push(options.status);
      }
      
      if (options.ticketType) {
        countQuery += ` AND t.ticket_type = $${countParams.length + 1}`;
        countParams.push(options.ticketType);
      }
      
      const countResult = await pool.query(countQuery, countParams);
      totalCount = parseInt(countResult.rows[0].count, 10) || 0;

      const offset = (page - 1) * limit;
      query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limit, offset);
    }

    const result = await pool.query(query, params);
    const tickets = result.rows;

    let pagination = undefined;
    if (page && limit && totalCount !== null) {
      const totalPages = Math.ceil(totalCount / limit);
      pagination = {
        page,
        limit,
        totalCount,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      };
    }

    return page && limit ? { data: tickets, pagination } : tickets;
  }

  /**
   * Update ticket
   */
  static async update(id, updateData) {
    const {
      status,
      assignedToUserId
    } = updateData;

    let query = 'UPDATE tickets SET updated_at = NOW()';
    const params = [];

    if (status) {
      query += `, status = $${params.length + 1}`;
      params.push(status);

      if (status === 'resolved' || status === 'closed') {
        query += `, resolved_at = NOW()`;
      }
    }

    if (assignedToUserId !== undefined) {
      if (assignedToUserId) {
        query += `, assigned_to_user_id = $${params.length + 1}, assigned_at = NOW()`;
        params.push(assignedToUserId);
      } else {
        query += `, assigned_to_user_id = NULL, assigned_at = NULL`;
      }
    }

    query += ` WHERE id = $${params.length + 1} RETURNING *`;
    params.push(id);

    const result = await pool.query(query, params);
    return result.rows[0];
  }
}

module.exports = Ticket;

