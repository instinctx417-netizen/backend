const pool = require('../config/database');

class OnboardingRequirement {
  static async create(data) {
    const { title, description, isRequired = true, displayOrder = 0, createdByUserId } = data;
    const result = await pool.query(
      `INSERT INTO onboarding_requirements (title, description, is_required, display_order, created_by_user_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [title, description, isRequired, displayOrder, createdByUserId]
    );
    return result.rows[0];
  }

  static async findAll() {
    const result = await pool.query(
      `SELECT * FROM onboarding_requirements
       ORDER BY display_order ASC, created_at DESC`
    );
    return result.rows;
  }

  static async findById(id) {
    const result = await pool.query(
      `SELECT * FROM onboarding_requirements WHERE id = $1`,
      [id]
    );
    return result.rows[0];
  }

  static async update(id, data) {
    const { title, description, isRequired, displayOrder } = data;
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (title !== undefined) {
      updates.push(`title = $${paramCount++}`);
      values.push(title);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(description);
    }
    if (isRequired !== undefined) {
      updates.push(`is_required = $${paramCount++}`);
      values.push(isRequired);
    }
    if (displayOrder !== undefined) {
      updates.push(`display_order = $${paramCount++}`);
      values.push(displayOrder);
    }

    if (updates.length === 0) {
      return this.findById(id);
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const result = await pool.query(
      `UPDATE onboarding_requirements
       SET ${updates.join(', ')}
       WHERE id = $${paramCount}
       RETURNING *`,
      values
    );
    return result.rows[0];
  }

  static async delete(id) {
    const result = await pool.query(
      `DELETE FROM onboarding_requirements WHERE id = $1 RETURNING *`,
      [id]
    );
    return result.rows[0];
  }
}

module.exports = OnboardingRequirement;

