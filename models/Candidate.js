const pool = require('../config/database');

class Candidate {
  /**
   * Create a new candidate
   */
  static async create(candidateData) {
    const {
      jobRequestId,
      userId,
      name,
      email,
      phone,
      linkedinUrl,
      portfolioUrl,
      resumePath,
      profileSummary
    } = candidateData;

    const query = `
      INSERT INTO candidates (
        job_request_id, user_id, name, email, phone,
        linkedin_url, portfolio_url, resume_path, profile_summary,
        status, delivered_at, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'delivered', NOW(), NOW(), NOW())
      RETURNING *
    `;

    const result = await pool.query(query, [
      jobRequestId,
      userId || null,
      name,
      email || null,
      phone || null,
      linkedinUrl || null,
      portfolioUrl || null,
      resumePath || null,
      profileSummary || null
    ]);

    return result.rows[0];
  }

  /**
   * Bulk create candidates
   */
  static async bulkCreate(candidates, jobRequestId) {
    if (!candidates || candidates.length === 0) return [];

    const values = [];
    const placeholders = [];
    let paramCount = 0;

    candidates.forEach((candidate, index) => {
      const params = [];
      params.push(jobRequestId);
      params.push(candidate.userId || null);
      params.push(candidate.name);
      params.push(candidate.email || null);
      params.push(candidate.phone || null);
      params.push(candidate.linkedinUrl || null);
      params.push(candidate.portfolioUrl || null);
      params.push(candidate.resumePath || null);
      params.push(candidate.profileSummary || null);

      const ph = params.map((_, i) => `$${paramCount + i + 1}`).join(', ');
      placeholders.push(`(${ph})`);
      values.push(...params);
      paramCount += params.length;
    });

    const query = `
      INSERT INTO candidates (
        job_request_id, user_id, name, email, phone,
        linkedin_url, portfolio_url, resume_path, profile_summary,
        status, delivered_at, created_at, updated_at
      )
      VALUES ${placeholders.join(', ')}
      RETURNING *
    `;

    const result = await pool.query(query, values);
    return result.rows;
  }

  /**
   * Find candidate by ID
   */
  static async findById(id) {
    const query = `
      SELECT 
        c.*,
        jr.title as job_title,
        jr.organization_id,
        u.first_name as user_first_name,
        u.last_name as user_last_name
      FROM candidates c
      JOIN job_requests jr ON jr.id = c.job_request_id
      LEFT JOIN users u ON u.id = c.user_id
      WHERE c.id = $1
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  /**
   * Find candidates by job request
   */
  static async findByJobRequest(jobRequestId) {
    const query = `
      SELECT 
        c.*,
        COUNT(DISTINCT i.id) as interview_count,
        MAX(i.scheduled_at) as last_interview_date
      FROM candidates c
      LEFT JOIN interviews i ON i.candidate_id = c.id
      WHERE c.job_request_id = $1
      GROUP BY c.id
      ORDER BY c.delivered_at DESC
    `;
    const result = await pool.query(query, [jobRequestId]);
    return result.rows;
  }

  /**
   * Update candidate status
   */
  static async updateStatus(id, status) {
    let query = 'UPDATE candidates SET status = $1, updated_at = NOW()';
    const params = [status];

    if (status === 'viewed') {
      query += ', viewed_at = NOW()';
    }

    query += ' WHERE id = $2 RETURNING *';
    params.push(id);

    const result = await pool.query(query, params);
    return result.rows[0];
  }

  /**
   * Update candidate
   */
  static async update(id, updateData) {
    const {
      name,
      email,
      phone,
      linkedinUrl,
      portfolioUrl,
      resumePath,
      profileSummary,
      status
    } = updateData;

    let query = 'UPDATE candidates SET updated_at = NOW()';
    const params = [];
    let paramCount = 0;

    if (name !== undefined) {
      paramCount++;
      query += `, name = $${paramCount}`;
      params.push(name);
    }
    if (email !== undefined) {
      paramCount++;
      query += `, email = $${paramCount}`;
      params.push(email);
    }
    if (phone !== undefined) {
      paramCount++;
      query += `, phone = $${paramCount}`;
      params.push(phone);
    }
    if (linkedinUrl !== undefined) {
      paramCount++;
      query += `, linkedin_url = $${paramCount}`;
      params.push(linkedinUrl);
    }
    if (portfolioUrl !== undefined) {
      paramCount++;
      query += `, portfolio_url = $${paramCount}`;
      params.push(portfolioUrl);
    }
    if (resumePath !== undefined) {
      paramCount++;
      query += `, resume_path = $${paramCount}`;
      params.push(resumePath);
    }
    if (profileSummary !== undefined) {
      paramCount++;
      query += `, profile_summary = $${paramCount}`;
      params.push(profileSummary);
    }
    if (status !== undefined) {
      paramCount++;
      query += `, status = $${paramCount}`;
      params.push(status);
      if (status === 'viewed') {
        query += ', viewed_at = NOW()';
      }
    }

    paramCount++;
    query += ` WHERE id = $${paramCount} RETURNING *`;
    params.push(id);

    const result = await pool.query(query, params);
    return result.rows[0];
  }
}

module.exports = Candidate;




