const pool = require('../config/database');

class OnboardingSubmission {
  static async create(data) {
    const { requirementId, userId, fileUrl, fileName, fileSize } = data;
    const result = await pool.query(
      `INSERT INTO onboarding_submissions (requirement_id, user_id, file_url, file_name, file_size)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (requirement_id, user_id) 
       DO UPDATE SET file_url = $3, file_name = $4, file_size = $5, updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [requirementId, userId, fileUrl, fileName, fileSize]
    );
    return result.rows[0];
  }

  static async findByUser(userId) {
    const result = await pool.query(
      `SELECT os.*, oreq.title as requirement_title, oreq.description as requirement_description, oreq.is_required
       FROM onboarding_submissions os
       JOIN onboarding_requirements oreq ON os.requirement_id = oreq.id
       WHERE os.user_id = $1
       ORDER BY oreq.display_order ASC`,
      [userId]
    );
    return result.rows;
  }

  static async findByRequirementAndUser(requirementId, userId) {
    const result = await pool.query(
      `SELECT * FROM onboarding_submissions
       WHERE requirement_id = $1 AND user_id = $2`,
      [requirementId, userId]
    );
    return result.rows[0];
  }

  static async delete(id) {
    const result = await pool.query(
      `DELETE FROM onboarding_submissions WHERE id = $1 RETURNING *`,
      [id]
    );
    return result.rows[0];
  }
}

module.exports = OnboardingSubmission;

