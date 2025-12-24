const pool = require('../config/database');

class Quiz {
  static async create(data) {
    const { question, optionA, optionB, optionC, optionD, correctAnswer, createdByUserId } = data;
    const result = await pool.query(
      `INSERT INTO quizzes (question, option_a, option_b, option_c, option_d, correct_answer, created_by_user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [question, optionA, optionB, optionC, optionD, correctAnswer, createdByUserId]
    );
    return result.rows[0];
  }

  static async findAll() {
    const result = await pool.query(
      `SELECT * FROM quizzes
       ORDER BY created_at DESC`
    );
    return result.rows;
  }

  static async findById(id) {
    const result = await pool.query(
      `SELECT * FROM quizzes WHERE id = $1`,
      [id]
    );
    return result.rows[0];
  }

  static async update(id, data) {
    const { question, optionA, optionB, optionC, optionD, correctAnswer } = data;
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (question !== undefined) {
      updates.push(`question = $${paramCount++}`);
      values.push(question);
    }
    if (optionA !== undefined) {
      updates.push(`option_a = $${paramCount++}`);
      values.push(optionA);
    }
    if (optionB !== undefined) {
      updates.push(`option_b = $${paramCount++}`);
      values.push(optionB);
    }
    if (optionC !== undefined) {
      updates.push(`option_c = $${paramCount++}`);
      values.push(optionC);
    }
    if (optionD !== undefined) {
      updates.push(`option_d = $${paramCount++}`);
      values.push(optionD);
    }
    if (correctAnswer !== undefined) {
      updates.push(`correct_answer = $${paramCount++}`);
      values.push(correctAnswer);
    }

    if (updates.length === 0) {
      return this.findById(id);
    }

    // Increment version when updating
    updates.push(`version = version + 1`);
    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const result = await pool.query(
      `UPDATE quizzes
       SET ${updates.join(', ')}
       WHERE id = $${paramCount}
       RETURNING *`,
      values
    );
    return result.rows[0];
  }

  static async delete(id) {
    const result = await pool.query(
      `DELETE FROM quizzes WHERE id = $1 RETURNING *`,
      [id]
    );
    return result.rows[0];
  }
}

module.exports = Quiz;

