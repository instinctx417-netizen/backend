const pool = require('../config/database');

class QuizAnswer {
  static async create(data) {
    const { quizId, userId, selectedAnswer, quizVersion, isCorrect } = data;
    const result = await pool.query(
      `INSERT INTO quiz_answers (quiz_id, user_id, selected_answer, quiz_version, is_correct)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (quiz_id, user_id, quiz_version) 
       DO UPDATE SET selected_answer = $3, is_correct = $5, updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [quizId, userId, selectedAnswer, quizVersion, isCorrect]
    );
    return result.rows[0];
  }

  static async findByUser(userId) {
    const result = await pool.query(
      `SELECT qa.*, q.question, q.option_a, q.option_b, q.option_c, q.option_d, q.correct_answer, q.version as current_version
       FROM quiz_answers qa
       JOIN quizzes q ON qa.quiz_id = q.id
       WHERE qa.user_id = $1
       ORDER BY qa.created_at DESC`,
      [userId]
    );
    // Include correct_answer in answer object since user has already answered
    // This allows showing the correct answer after submission
    return result.rows;
  }

  static async findByQuizAndUser(quizId, userId) {
    const result = await pool.query(
      `SELECT qa.*, q.version as current_version
       FROM quiz_answers qa
       JOIN quizzes q ON qa.quiz_id = q.id
       WHERE qa.quiz_id = $1 AND qa.user_id = $2
       ORDER BY qa.quiz_version DESC
       LIMIT 1`,
      [quizId, userId]
    );
    return result.rows[0];
  }

  static async getStatsByUser(userId) {
    const result = await pool.query(
      `SELECT 
         COUNT(*) as total_answered,
         SUM(CASE WHEN qa.is_correct THEN 1 ELSE 0 END) as correct_answers,
         SUM(CASE WHEN qa.quiz_version < q.version THEN 1 ELSE 0 END) as outdated_answers
       FROM quiz_answers qa
       JOIN quizzes q ON qa.quiz_id = q.id
       WHERE qa.user_id = $1`,
      [userId]
    );
    return result.rows[0];
  }
}

module.exports = QuizAnswer;

