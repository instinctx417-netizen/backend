const pool = require('../config/database');

class UserOrganization {
  /**
   * Add user to organization
   */
  static async create(userOrgData) {
    const { userId, organizationId, departmentId, role, isPrimary } = userOrgData;
    const query = `
      INSERT INTO user_organizations (user_id, organization_id, department_id, role, is_primary, joined_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING *
    `;
    const result = await pool.query(query, [
      userId, 
      organizationId, 
      departmentId || null, 
      role, 
      isPrimary || false
    ]);
    return result.rows[0];
  }

  /**
   * Find user's organizations
   */
  static async findByUser(userId) {
    const query = `
      SELECT 
        uo.*,
        o.name as organization_name,
        o.industry,
        o.company_size,
        o.status,
        d.name as department_name
      FROM user_organizations uo
      JOIN organizations o ON o.id = uo.organization_id
      LEFT JOIN departments d ON d.id = uo.department_id
      WHERE uo.user_id = $1
      ORDER BY uo.is_primary DESC, uo.joined_at DESC
    `;
    const result = await pool.query(query, [userId]);
    return result.rows;
  }

  /**
   * Find organization's users
   */
  static async findByOrganization(organizationId) {
    const query = `
      SELECT 
        uo.*,
        u.id as user_id,
        u.email,
        u.first_name,
        u.last_name,
        u.user_type,
        d.name as department_name
      FROM user_organizations uo
      JOIN users u ON u.id = uo.user_id
      LEFT JOIN departments d ON d.id = uo.department_id
      WHERE uo.organization_id = $1
      ORDER BY uo.role, u.first_name, u.last_name
    `;
    const result = await pool.query(query, [organizationId]);
    return result.rows;
  }

  /**
   * Find by user and organization
   */
  static async findByUserAndOrganization(userId, organizationId) {
    const query = `
      SELECT 
        uo.*,
        o.name as organization_name,
        o.status,
        d.name as department_name
      FROM user_organizations uo
      JOIN organizations o ON o.id = uo.organization_id
      LEFT JOIN departments d ON d.id = uo.department_id
      WHERE uo.user_id = $1 AND uo.organization_id = $2
    `;
    const result = await pool.query(query, [userId, organizationId]);
    return result.rows[0];
  }

  /**
   * Update user organization
   */
  static async update(id, updateData) {
    const { departmentId, role, isPrimary } = updateData;
    const query = `
      UPDATE user_organizations 
      SET department_id = COALESCE($1, department_id),
          role = COALESCE($2, role),
          is_primary = COALESCE($3, is_primary)
      WHERE id = $4
      RETURNING *
    `;
    const result = await pool.query(query, [departmentId, role, isPrimary, id]);
    return result.rows[0];
  }

  /**
   * Remove user from organization
   */
  static async delete(userId, organizationId) {
    const query = 'DELETE FROM user_organizations WHERE user_id = $1 AND organization_id = $2 RETURNING id';
    const result = await pool.query(query, [userId, organizationId]);
    return result.rows[0];
  }
}

module.exports = UserOrganization;




