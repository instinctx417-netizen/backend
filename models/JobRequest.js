const pool = require('../config/database');

class JobRequest {
  /**
   * Create a new job request
   */
  static async create(jobData) {
    const {
      organizationId,
      departmentId,
      requestedByUserId,
      hiringManagerUserId,
      title,
      jobDescription,
      requirements,
      timelineToHire,
      priority
    } = jobData;

    const query = `
      INSERT INTO job_requests (
        organization_id, department_id, requested_by_user_id, hiring_manager_user_id,
        title, job_description, requirements, timeline_to_hire, priority,
        status, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'received', NOW(), NOW())
      RETURNING *
    `;

    const result = await pool.query(query, [
      organizationId,
      departmentId || null,
      requestedByUserId,
      hiringManagerUserId || null,
      title,
      jobDescription,
      requirements || null,
      timelineToHire || null,
      priority || 'normal'
    ]);

    return result.rows[0];
  }

  /**
   * Find job request by ID
   */
  static async findById(id) {
    const query = `
      SELECT 
        jr.*,
        o.name as organization_name,
        d.name as department_name,
        u1.first_name as requested_by_first_name,
        u1.last_name as requested_by_last_name,
        u1.email as requested_by_email,
        u2.first_name as hiring_manager_first_name,
        u2.last_name as hiring_manager_last_name,
        u2.email as hiring_manager_email,
        u3.first_name as assigned_hr_first_name,
        u3.last_name as assigned_hr_last_name,
        u3.email as assigned_hr_email
      FROM job_requests jr
      JOIN organizations o ON o.id = jr.organization_id
      LEFT JOIN departments d ON d.id = jr.department_id
      JOIN users u1 ON u1.id = jr.requested_by_user_id
      LEFT JOIN users u2 ON u2.id = jr.hiring_manager_user_id
      LEFT JOIN users u3 ON u3.id = jr.assigned_to_hr_user_id
      WHERE jr.id = $1
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  /**
   * Find job requests by organization
   */
  static async findByOrganization(organizationId, filters = {}) {
    let query = `
      SELECT 
        jr.*,
        d.name as department_name,
        COUNT(DISTINCT c.id) as candidate_count,
        COUNT(DISTINCT i.id) as interview_count
      FROM job_requests jr
      LEFT JOIN departments d ON d.id = jr.department_id
      LEFT JOIN candidates c ON c.job_request_id = jr.id
      LEFT JOIN interviews i ON i.job_request_id = jr.id
      WHERE jr.organization_id = $1
    `;
    const params = [organizationId];
    let paramCount = 1;

    if (filters.status) {
      paramCount++;
      query += ` AND jr.status = $${paramCount}`;
      params.push(filters.status);
    }

    if (filters.departmentId) {
      paramCount++;
      query += ` AND jr.department_id = $${paramCount}`;
      params.push(filters.departmentId);
    }

    query += ` GROUP BY jr.id, d.name ORDER BY jr.created_at DESC`;
    const result = await pool.query(query, params);
    return result.rows;
  }

  /**
   * Find job requests by department
   */
  static async findByDepartment(departmentId) {
    const query = `
      SELECT 
        jr.*,
        COUNT(DISTINCT c.id) as candidate_count,
        COUNT(DISTINCT i.id) as interview_count
      FROM job_requests jr
      LEFT JOIN candidates c ON c.job_request_id = jr.id
      LEFT JOIN interviews i ON i.job_request_id = jr.id
      WHERE jr.department_id = $1
      GROUP BY jr.id
      ORDER BY jr.created_at DESC
    `;
    const result = await pool.query(query, [departmentId]);
    return result.rows;
  }

  /**
   * Update job request
   */
  static async update(id, updateData) {
    const {
      title,
      jobDescription,
      requirements,
      timelineToHire,
      priority,
      status,
      assignedToHrUserId,
      hiringManagerUserId
    } = updateData;

    let query = 'UPDATE job_requests SET updated_at = NOW()';
    const params = [];
    let paramCount = 0;

    if (title !== undefined) {
      paramCount++;
      query += `, title = $${paramCount}`;
      params.push(title);
    }
    if (jobDescription !== undefined) {
      paramCount++;
      query += `, job_description = $${paramCount}`;
      params.push(jobDescription);
    }
    if (requirements !== undefined) {
      paramCount++;
      query += `, requirements = $${paramCount}`;
      params.push(requirements);
    }
    if (timelineToHire !== undefined) {
      paramCount++;
      query += `, timeline_to_hire = $${paramCount}`;
      params.push(timelineToHire);
    }
    if (priority !== undefined) {
      paramCount++;
      query += `, priority = $${paramCount}`;
      params.push(priority);
    }
    if (status !== undefined) {
      paramCount++;
      query += `, status = $${paramCount}`;
      params.push(status);
    }
    if (assignedToHrUserId !== undefined) {
      paramCount++;
      query += `, assigned_to_hr_user_id = $${paramCount}, assigned_at = NOW()`;
      params.push(assignedToHrUserId);
    }
    if (hiringManagerUserId !== undefined) {
      paramCount++;
      query += `, hiring_manager_user_id = $${paramCount}`;
      params.push(hiringManagerUserId);
    }
    if (status === 'candidates_delivered') {
      query += `, candidates_delivered_at = NOW()`;
    }

    paramCount++;
    query += ` WHERE id = $${paramCount} RETURNING *`;
    params.push(id);

    const result = await pool.query(query, params);
    return result.rows[0];
  }

  /**
   * Find job requests assigned to HR user
   */
  static async findByAssignedHR(hrUserId) {
    const query = `
      SELECT 
        jr.*,
        o.name as organization_name,
        d.name as department_name,
        u.first_name as requested_by_first_name,
        u.last_name as requested_by_last_name
      FROM job_requests jr
      JOIN organizations o ON o.id = jr.organization_id
      LEFT JOIN departments d ON d.id = jr.department_id
      JOIN users u ON u.id = jr.requested_by_user_id
      WHERE jr.assigned_to_hr_user_id = $1
      ORDER BY jr.created_at DESC
    `;
    const result = await pool.query(query, [hrUserId]);
    return result.rows;
  }

  /**
   * Get HR statistics
   */
  static async getHRStatistics(hrUserId) {
    const query = `
      SELECT 
        COUNT(*) FILTER (WHERE status = 'assigned_to_hr') as assigned_count,
        COUNT(*) FILTER (WHERE status = 'shortlisting') as shortlisting_count,
        COUNT(*) FILTER (WHERE status = 'candidates_delivered') as delivered_count,
        COUNT(*) as total_count
      FROM job_requests
      WHERE assigned_to_hr_user_id = $1
    `;
    const result = await pool.query(query, [hrUserId]);
    const stats = result.rows[0];
    // Convert snake_case to camelCase for frontend consistency
    return {
      assignedCount: parseInt(stats.assigned_count) || 0,
      shortlistingCount: parseInt(stats.shortlisting_count) || 0,
      deliveredCount: parseInt(stats.delivered_count) || 0,
      totalCount: parseInt(stats.total_count) || 0,
    };
  }

  /**
   * Find all job requests (for admin)
   */
  static async findAll(filters = {}) {
    let query = `
      SELECT 
        jr.*,
        o.name as organization_name,
        d.name as department_name,
        u1.first_name as requested_by_first_name,
        u1.last_name as requested_by_last_name,
        u3.first_name as assigned_hr_first_name,
        u3.last_name as assigned_hr_last_name,
        COUNT(DISTINCT c.id) as candidate_count
      FROM job_requests jr
      JOIN organizations o ON o.id = jr.organization_id
      LEFT JOIN departments d ON d.id = jr.department_id
      JOIN users u1 ON u1.id = jr.requested_by_user_id
      LEFT JOIN users u3 ON u3.id = jr.assigned_to_hr_user_id
      LEFT JOIN candidates c ON c.job_request_id = jr.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 0;

    if (filters.status) {
      paramCount++;
      query += ` AND jr.status = $${paramCount}`;
      params.push(filters.status);
    }

    query += ` GROUP BY jr.id, o.name, d.name, u1.first_name, u1.last_name, u3.first_name, u3.last_name ORDER BY jr.created_at DESC`;
    const result = await pool.query(query, params);
    return result.rows;
  }

  /**
   * Get job request statistics
   */
  static async getStatistics(organizationId, departmentId = null) {
    let query = `
      SELECT 
        COUNT(*) FILTER (WHERE status = 'received') as received_count,
        COUNT(*) FILTER (WHERE status = 'assigned_to_hr') as assigned_count,
        COUNT(*) FILTER (WHERE status = 'shortlisting') as shortlisting_count,
        COUNT(*) FILTER (WHERE status = 'candidates_delivered') as candidates_delivered_count,
        COUNT(*) FILTER (WHERE status = 'interviews_scheduled') as interviews_scheduled_count,
        COUNT(*) FILTER (WHERE status = 'selection_pending') as selection_pending_count,
        COUNT(*) FILTER (WHERE status = 'hired') as hired_count,
        COUNT(*) as total_count
      FROM job_requests
      WHERE organization_id = $1
    `;
    const params = [organizationId];

    if (departmentId) {
      query += ` AND department_id = $2`;
      params.push(departmentId);
    }

    const result = await pool.query(query, params);
    return result.rows[0];
  }
}

module.exports = JobRequest;




