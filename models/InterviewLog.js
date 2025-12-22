const pool = require('../config/database');

class InterviewLog {
  /**
   * Create a new interview log entry
   */
  static async create(logData) {
    const {
      interviewId,
      actionType,
      performedByUserId,
      performedByUserType,
      performedByUserName,
      oldValue,
      newValue,
      details
    } = logData;

    const query = `
      INSERT INTO interview_logs (
        interview_id, action_type, performed_by_user_id, performed_by_user_type,
        performed_by_user_name, old_value, new_value, details, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      RETURNING *
    `;

    const result = await pool.query(query, [
      interviewId,
      actionType,
      performedByUserId || null,
      performedByUserType || null,
      performedByUserName || null,
      oldValue ? JSON.stringify(oldValue) : null,
      newValue ? JSON.stringify(newValue) : null,
      details ? JSON.stringify(details) : null
    ]);

    return result.rows[0];
  }

  /**
   * Find logs with filters and pagination
   */
  static async findAll(filters = {}, options = {}) {
    let query = `
      SELECT 
        il.*,
        i.job_request_id,
        jr.title as job_title,
        c.name as candidate_name,
        o.name as organization_name
      FROM interview_logs il
      JOIN interviews i ON i.id = il.interview_id
      JOIN job_requests jr ON jr.id = i.job_request_id
      JOIN candidates c ON c.id = i.candidate_id
      JOIN organizations o ON o.id = jr.organization_id
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 0;

    if (filters.interviewId) {
      paramCount++;
      query += ` AND il.interview_id = $${paramCount}`;
      params.push(filters.interviewId);
    }

    if (filters.actionType) {
      paramCount++;
      query += ` AND il.action_type = $${paramCount}`;
      params.push(filters.actionType);
    }

    if (filters.performedByUserId) {
      paramCount++;
      query += ` AND il.performed_by_user_id = $${paramCount}`;
      params.push(filters.performedByUserId);
    }

    if (filters.organizationId) {
      paramCount++;
      query += ` AND o.id = $${paramCount}`;
      params.push(filters.organizationId);
    }

    if (filters.startDate) {
      paramCount++;
      query += ` AND il.created_at >= $${paramCount}`;
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      paramCount++;
      query += ` AND il.created_at <= $${paramCount}`;
      params.push(filters.endDate);
    }

    query += ` ORDER BY il.created_at DESC`;

    const page = options.page && options.page > 0 ? options.page : null;
    const limit = options.limit && options.limit > 0 ? options.limit : null;
    let totalCount = null;

    if (page && limit) {
      let countQuery = `
        SELECT COUNT(*)
        FROM interview_logs il
        JOIN interviews i ON i.id = il.interview_id
        JOIN job_requests jr ON jr.id = i.job_request_id
        JOIN organizations o ON o.id = jr.organization_id
        WHERE 1=1
      `;
      const countParams = [];
      let countParamCount = 0;

      if (filters.interviewId) {
        countParamCount++;
        countQuery += ` AND il.interview_id = $${countParamCount}`;
        countParams.push(filters.interviewId);
      }

      if (filters.actionType) {
        countParamCount++;
        countQuery += ` AND il.action_type = $${countParamCount}`;
        countParams.push(filters.actionType);
      }

      if (filters.performedByUserId) {
        countParamCount++;
        countQuery += ` AND il.performed_by_user_id = $${countParamCount}`;
        countParams.push(filters.performedByUserId);
      }

      if (filters.organizationId) {
        countParamCount++;
        countQuery += ` AND o.id = $${countParamCount}`;
        countParams.push(filters.organizationId);
      }

      if (filters.startDate) {
        countParamCount++;
        countQuery += ` AND il.created_at >= $${countParamCount}`;
        countParams.push(filters.startDate);
      }

      if (filters.endDate) {
        countParamCount++;
        countQuery += ` AND il.created_at <= $${countParamCount}`;
        countParams.push(filters.endDate);
      }

      const countResult = await pool.query(countQuery, countParams);
      totalCount = parseInt(countResult.rows[0].count, 10) || 0;

      const offset = (page - 1) * limit;
      paramCount++;
      params.push(limit);
      paramCount++;
      params.push(offset);
      query += ` LIMIT $${paramCount - 1} OFFSET $${paramCount}`;
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
}

module.exports = InterviewLog;

