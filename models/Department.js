const pool = require('../config/database');

class Department {
  /**
   * Create a new department
   */
  static async create(deptData) {
    const { organizationId, name, description } = deptData;
    const query = `
      INSERT INTO departments (organization_id, name, description, created_at, updated_at)
      VALUES ($1, $2, $3, NOW(), NOW())
      RETURNING *
    `;
    const result = await pool.query(query, [organizationId, name, description || null]);
    return result.rows[0];
  }

  /**
   * Find department by ID
   */
  static async findById(id) {
    const query = 'SELECT * FROM departments WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  /**
   * Find departments by organization
   */
  static async findByOrganization(organizationId) {
    const query = 'SELECT * FROM departments WHERE organization_id = $1 ORDER BY name';
    const result = await pool.query(query, [organizationId]);
    return result.rows;
  }

  /**
   * Update department
   */
  static async update(id, updateData) {
    const { name, description } = updateData;
    const query = `
      UPDATE departments 
      SET name = COALESCE($1, name),
          description = COALESCE($2, description),
          updated_at = NOW()
      WHERE id = $3
      RETURNING *
    `;
    const result = await pool.query(query, [name, description, id]);
    return result.rows[0];
  }

  /**
   * Delete department
   */
  static async delete(id) {
    const query = 'DELETE FROM departments WHERE id = $1 RETURNING id';
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }
}

module.exports = Department;




