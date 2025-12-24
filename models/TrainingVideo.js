const pool = require('../config/database');

class TrainingVideo {
  static async create(data) {
    const { title, youtubeUrl, displayOrder = 0, createdByUserId } = data;
    const result = await pool.query(
      `INSERT INTO training_videos (title, youtube_url, display_order, created_by_user_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [title, youtubeUrl, displayOrder, createdByUserId]
    );
    return result.rows[0];
  }

  static async findAll() {
    const result = await pool.query(
      `SELECT * FROM training_videos
       ORDER BY display_order ASC, created_at DESC`
    );
    return result.rows;
  }

  static async findById(id) {
    const result = await pool.query(
      `SELECT * FROM training_videos WHERE id = $1`,
      [id]
    );
    return result.rows[0];
  }

  static async update(id, data) {
    const { title, youtubeUrl, displayOrder } = data;
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (title !== undefined) {
      updates.push(`title = $${paramCount++}`);
      values.push(title);
    }
    if (youtubeUrl !== undefined) {
      updates.push(`youtube_url = $${paramCount++}`);
      values.push(youtubeUrl);
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
      `UPDATE training_videos
       SET ${updates.join(', ')}
       WHERE id = $${paramCount}
       RETURNING *`,
      values
    );
    return result.rows[0];
  }

  static async delete(id) {
    const result = await pool.query(
      `DELETE FROM training_videos WHERE id = $1 RETURNING *`,
      [id]
    );
    return result.rows[0];
  }
}

module.exports = TrainingVideo;

