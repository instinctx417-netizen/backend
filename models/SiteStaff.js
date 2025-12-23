const pool = require('../config/database');

class SiteStaff {
  /**
   * Create a new site staff record (hire a candidate)
   */
  static async create(staffData) {
    const {
      userId,
      candidateId,
      jobRequestId,
      organizationId,
      positionTitle
    } = staffData;

    const query = `
      INSERT INTO site_staff (
        user_id, candidate_id, job_request_id, organization_id,
        position_title, hired_at, status, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, NOW(), 'active', NOW(), NOW())
      RETURNING *
    `;

    const result = await pool.query(query, [
      userId,
      candidateId,
      jobRequestId,
      organizationId,
      positionTitle
    ]);

    return result.rows[0];
  }

  /**
   * Find site staff by user ID
   */
  static async findByUserId(userId) {
    const query = `
      SELECT ss.*, 
        u.email, u.first_name, u.last_name, u.full_name,
        c.name as candidate_name,
        jr.title as job_title,
        o.name as organization_name
      FROM site_staff ss
      JOIN users u ON u.id = ss.user_id
      JOIN candidates c ON c.id = ss.candidate_id
      JOIN job_requests jr ON jr.id = ss.job_request_id
      JOIN organizations o ON o.id = ss.organization_id
      WHERE ss.user_id = $1 AND ss.status = 'active'
      ORDER BY ss.hired_at DESC
    `;
    const result = await pool.query(query, [userId]);
    return result.rows;
  }

  /**
   * Find site staff by organization ID
   */
  static async findByOrganizationId(organizationId) {
    const query = `
      SELECT ss.*, 
        u.email, u.first_name, u.last_name, u.full_name,
        c.name as candidate_name,
        jr.title as job_title
      FROM site_staff ss
      JOIN users u ON u.id = ss.user_id
      JOIN candidates c ON c.id = ss.candidate_id
      JOIN job_requests jr ON jr.id = ss.job_request_id
      WHERE ss.organization_id = $1 AND ss.status = 'active'
      ORDER BY ss.hired_at DESC
    `;
    const result = await pool.query(query, [organizationId]);
    return result.rows;
  }

  /**
   * Find site staff by candidate ID
   */
  static async findByCandidateId(candidateId) {
    const query = `
      SELECT ss.*, 
        u.email, u.first_name, u.last_name, u.full_name,
        c.name as candidate_name,
        jr.title as job_title,
        o.name as organization_name
      FROM site_staff ss
      JOIN users u ON u.id = ss.user_id
      JOIN candidates c ON c.id = ss.candidate_id
      JOIN job_requests jr ON jr.id = ss.job_request_id
      JOIN organizations o ON o.id = ss.organization_id
      WHERE ss.candidate_id = $1 AND ss.status = 'active'
      ORDER BY ss.hired_at DESC
    `;
    const result = await pool.query(query, [candidateId]);
    return result.rows[0];
  }

  /**
   * Update site staff status (e.g., mark as resigned)
   */
  static async updateStatus(id, status, resignedAt = null) {
    let query = 'UPDATE site_staff SET status = $1, updated_at = NOW()';
    const params = [status];

    if (status === 'resigned' && resignedAt) {
      query += ', resigned_at = $2';
      params.push(resignedAt);
    } else if (status === 'resigned') {
      query += ', resigned_at = NOW()';
    }

    query += ' WHERE id = $' + (params.length + 1) + ' RETURNING *';
    params.push(id);

    const result = await pool.query(query, params);
    return result.rows[0];
  }

  /**
   * Find site staff by user ID (returns first active record)
   */
  static async findActiveByUserId(userId) {
    const query = `
      SELECT ss.*, 
        u.email, u.first_name, u.last_name, u.full_name,
        c.name as candidate_name,
        jr.title as job_title,
        o.name as organization_name
      FROM site_staff ss
      JOIN users u ON u.id = ss.user_id
      JOIN candidates c ON c.id = ss.candidate_id
      JOIN job_requests jr ON jr.id = ss.job_request_id
      JOIN organizations o ON o.id = ss.organization_id
      WHERE ss.user_id = $1 AND ss.status = 'active'
      ORDER BY ss.hired_at DESC
      LIMIT 1
    `;
    const result = await pool.query(query, [userId]);
    return result.rows[0];
  }

  /**
   * Update staff profile data
   */
  static async updateProfileData(userId, profileData) {
    const query = `
      UPDATE site_staff 
      SET profile_data = $1, updated_at = NOW()
      WHERE user_id = $2 AND status = 'active'
      RETURNING *
    `;
    const result = await pool.query(query, [JSON.stringify(profileData), userId]);
    return result.rows[0];
  }
}

module.exports = SiteStaff;

