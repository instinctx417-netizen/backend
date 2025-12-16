const pool = require('../config/database');

class Interview {
  /**
   * Create a new interview
   */
  static async create(interviewData) {
    const {
      jobRequestId,
      candidateId,
      scheduledByUserId,
      scheduledAt,
      durationMinutes,
      meetingLink,
      meetingPlatform,
      notes
    } = interviewData;

    const query = `
      INSERT INTO interviews (
        job_request_id, candidate_id, scheduled_by_user_id,
        scheduled_at, duration_minutes, meeting_link, meeting_platform,
        status, notes, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'scheduled', $8, NOW(), NOW())
      RETURNING *
    `;

    const result = await pool.query(query, [
      jobRequestId,
      candidateId,
      scheduledByUserId,
      scheduledAt,
      durationMinutes || 60,
      meetingLink || null,
      meetingPlatform || null,
      notes || null
    ]);

    return result.rows[0];
  }

  /**
   * Find interview by ID
   */
  static async findById(id) {
    const query = `
      SELECT 
        i.*,
        jr.title as job_title,
        jr.organization_id,
        c.name as candidate_name,
        c.email as candidate_email,
        u.first_name as scheduled_by_first_name,
        u.last_name as scheduled_by_last_name
      FROM interviews i
      JOIN job_requests jr ON jr.id = i.job_request_id
      JOIN candidates c ON c.id = i.candidate_id
      JOIN users u ON u.id = i.scheduled_by_user_id
      WHERE i.id = $1
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  /**
   * Find interviews by job request
   */
  static async findByJobRequest(jobRequestId) {
    const query = `
      SELECT 
        i.*,
        c.name as candidate_name,
        c.email as candidate_email,
        c.status as candidate_status,
        u.first_name as scheduled_by_first_name,
        u.last_name as scheduled_by_last_name
      FROM interviews i
      JOIN candidates c ON c.id = i.candidate_id
      JOIN users u ON u.id = i.scheduled_by_user_id
      WHERE i.job_request_id = $1
      ORDER BY i.scheduled_at ASC
    `;
    const result = await pool.query(query, [jobRequestId]);
    return result.rows;
  }

  /**
   * Find interviews by candidate
   */
  static async findByCandidate(candidateId) {
    const query = `
      SELECT 
        i.*,
        jr.title as job_title,
        jr.organization_id
      FROM interviews i
      JOIN job_requests jr ON jr.id = i.job_request_id
      WHERE i.candidate_id = $1
      ORDER BY i.scheduled_at ASC
    `;
    const result = await pool.query(query, [candidateId]);
    return result.rows;
  }

  /**
   * Find upcoming interviews for organization
   */
  static async findUpcomingByOrganization(organizationId, limit = 10) {
    const query = `
      SELECT 
        i.*,
        jr.title as job_title,
        jr.department_id,
        d.name as department_name,
        c.name as candidate_name,
        c.email as candidate_email
      FROM interviews i
      JOIN job_requests jr ON jr.id = i.job_request_id
      LEFT JOIN departments d ON d.id = jr.department_id
      JOIN candidates c ON c.id = i.candidate_id
      WHERE jr.organization_id = $1 
        AND i.scheduled_at > NOW()
        AND i.status IN ('scheduled', 'confirmed')
      ORDER BY i.scheduled_at ASC
      LIMIT $2
    `;
    const result = await pool.query(query, [organizationId, limit]);
    return result.rows;
  }

  /**
   * Find all interviews (for admin)
   */
  static async findAll() {
    const query = `
      SELECT 
        i.*,
        jr.title as job_title,
        jr.organization_id,
        jr.department_id,
        d.name as department_name,
        o.name as organization_name,
        c.name as candidate_name,
        c.email as candidate_email,
        u.first_name as scheduled_by_first_name,
        u.last_name as scheduled_by_last_name
      FROM interviews i
      JOIN job_requests jr ON jr.id = i.job_request_id
      JOIN organizations o ON o.id = jr.organization_id
      LEFT JOIN departments d ON d.id = jr.department_id
      JOIN candidates c ON c.id = i.candidate_id
      JOIN users u ON u.id = i.scheduled_by_user_id
      ORDER BY i.scheduled_at DESC
    `;
    const result = await pool.query(query);
    return result.rows;
  }

  /**
   * Find interviews by assigned HR user
   */
  static async findByAssignedHR(hrUserId) {
    const query = `
      SELECT 
        i.*,
        jr.title as job_title,
        jr.organization_id,
        jr.department_id,
        d.name as department_name,
        o.name as organization_name,
        c.name as candidate_name,
        c.email as candidate_email,
        u.first_name as scheduled_by_first_name,
        u.last_name as scheduled_by_last_name
      FROM interviews i
      JOIN job_requests jr ON jr.id = i.job_request_id
      JOIN organizations o ON o.id = jr.organization_id
      LEFT JOIN departments d ON d.id = jr.department_id
      JOIN candidates c ON c.id = i.candidate_id
      JOIN users u ON u.id = i.scheduled_by_user_id
      WHERE jr.assigned_to_hr_user_id = $1
      ORDER BY i.scheduled_at DESC
    `;
    const result = await pool.query(query, [hrUserId]);
    return result.rows;
  }

  /**
   * Find interviews where user is a participant
   */
  static async findByParticipant(userId) {
    const query = `
      SELECT DISTINCT
        i.*,
        jr.title as job_title,
        jr.organization_id,
        jr.department_id,
        d.name as department_name,
        o.name as organization_name,
        c.name as candidate_name,
        c.email as candidate_email,
        u.first_name as scheduled_by_first_name,
        u.last_name as scheduled_by_last_name
      FROM interviews i
      JOIN interview_participants ip ON ip.interview_id = i.id
      JOIN job_requests jr ON jr.id = i.job_request_id
      JOIN organizations o ON o.id = jr.organization_id
      LEFT JOIN departments d ON d.id = jr.department_id
      JOIN candidates c ON c.id = i.candidate_id
      JOIN users u ON u.id = i.scheduled_by_user_id
      WHERE ip.user_id = $1
      ORDER BY i.scheduled_at DESC
    `;
    const result = await pool.query(query, [userId]);
    return result.rows;
  }

  /**
   * Find all interviews for organization
   */
  static async findByOrganization(organizationId) {
    const query = `
      SELECT 
        i.*,
        jr.title as job_title,
        jr.department_id,
        d.name as department_name,
        c.name as candidate_name,
        c.email as candidate_email,
        u.first_name as scheduled_by_first_name,
        u.last_name as scheduled_by_last_name
      FROM interviews i
      JOIN job_requests jr ON jr.id = i.job_request_id
      LEFT JOIN departments d ON d.id = jr.department_id
      JOIN candidates c ON c.id = i.candidate_id
      JOIN users u ON u.id = i.scheduled_by_user_id
      WHERE jr.organization_id = $1
      ORDER BY i.scheduled_at DESC
    `;
    const result = await pool.query(query, [organizationId]);
    return result.rows;
  }

  /**
   * Update interview
   */
  static async update(id, updateData) {
    const {
      scheduledAt,
      durationMinutes,
      meetingLink,
      meetingPlatform,
      status,
      notes,
      feedback
    } = updateData;

    let query = 'UPDATE interviews SET updated_at = NOW()';
    const params = [];
    let paramCount = 0;

    if (scheduledAt !== undefined) {
      paramCount++;
      query += `, scheduled_at = $${paramCount}`;
      params.push(scheduledAt);
    }
    if (durationMinutes !== undefined) {
      paramCount++;
      query += `, duration_minutes = $${paramCount}`;
      params.push(durationMinutes);
    }
    if (meetingLink !== undefined) {
      paramCount++;
      query += `, meeting_link = $${paramCount}`;
      params.push(meetingLink);
    }
    if (meetingPlatform !== undefined) {
      paramCount++;
      query += `, meeting_platform = $${paramCount}`;
      params.push(meetingPlatform);
    }
    if (status !== undefined) {
      paramCount++;
      query += `, status = $${paramCount}`;
      params.push(status);
    }
    if (notes !== undefined) {
      paramCount++;
      query += `, notes = $${paramCount}`;
      params.push(notes);
    }
    if (feedback !== undefined) {
      paramCount++;
      query += `, feedback = $${paramCount}`;
      params.push(feedback);
    }

    paramCount++;
    query += ` WHERE id = $${paramCount} RETURNING *`;
    params.push(id);

    const result = await pool.query(query, params);
    return result.rows[0];
  }

  /**
   * Add participant to interview
   */
  static async addParticipant(interviewId, userId, role = 'attendee') {
    const query = `
      INSERT INTO interview_participants (interview_id, user_id, role, created_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (interview_id, user_id) DO NOTHING
      RETURNING *
    `;
    const result = await pool.query(query, [interviewId, userId, role]);
    return result.rows[0];
  }

  /**
   * Get interview participants
   */
  static async getParticipants(interviewId) {
    const query = `
      SELECT 
        ip.*,
        u.first_name,
        u.last_name,
        u.email
      FROM interview_participants ip
      JOIN users u ON u.id = ip.user_id
      WHERE ip.interview_id = $1
      ORDER BY ip.role, u.first_name
    `;
    const result = await pool.query(query, [interviewId]);
    return result.rows;
  }

  /**
   * Remove participant from interview
   */
  static async removeParticipant(interviewId, userId) {
    const query = `
      DELETE FROM interview_participants 
      WHERE interview_id = $1 AND user_id = $2
      RETURNING id
    `;
    const result = await pool.query(query, [interviewId, userId]);
    return result.rows[0];
  }
}

module.exports = Interview;




