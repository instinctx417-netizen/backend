const pool = require('../config/database');

class Organization {
  /**
   * Create a new organization
   */
  static async create(orgData) {
    const { name, industry, companySize } = orgData;
    const query = `
      INSERT INTO organizations (name, industry, company_size, created_at, updated_at)
      VALUES ($1, $2, $3, NOW(), NOW())
      RETURNING *
    `;
    // Handle industry: if it's a non-empty string, trim and use it; otherwise use null
    let industryValue = null;
    if (industry && typeof industry === 'string') {
      const trimmed = industry.trim();
      industryValue = trimmed !== '' ? trimmed : null;
    }
    
    // Handle companySize: if it's a non-empty string, use it; otherwise use null
    let companySizeValue = null;
    if (companySize && typeof companySize === 'string') {
      const trimmed = companySize.trim();
      companySizeValue = trimmed !== '' ? trimmed : null;
    }
    
    const result = await pool.query(query, [name, industryValue, companySizeValue]);
    return result.rows[0];
  }

  /**
   * Find organization by ID
   */
  static async findById(id) {
    const query = 'SELECT * FROM organizations WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  /**
   * Find organization by name
   */
  static async findByName(name) {
    const query = 'SELECT * FROM organizations WHERE name = $1';
    const result = await pool.query(query, [name]);
    return result.rows[0];
  }

  /**
   * Get all organizations
   */
  static async findAll() {
    const query = 'SELECT * FROM organizations ORDER BY created_at DESC';
    const result = await pool.query(query);
    return result.rows;
  }

  /**
   * Activate organization
   */
  static async activate(id) {
    const query = `
      UPDATE organizations 
      SET status = 'active', updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  /**
   * Deactivate organization
   */
  static async deactivate(id) {
    const query = `
      UPDATE organizations 
      SET status = 'inactive', updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  /**
   * Update organization
   */
  static async update(id, updateData) {
    const { name, industry, companySize } = updateData;
    const query = `
      UPDATE organizations 
      SET name = COALESCE($1, name),
          industry = COALESCE($2, industry),
          company_size = COALESCE($3, company_size),
          updated_at = NOW()
      WHERE id = $4
      RETURNING *
    `;
    const result = await pool.query(query, [name, industry, companySize, id]);
    return result.rows[0];
  }

  /**
   * Get organization with departments
   */
  static async findByIdWithDepartments(id) {
    const query = `
      SELECT 
        o.*,
        COALESCE(
          json_agg(
            json_build_object(
              'id', d.id,
              'name', d.name,
              'description', d.description,
              'createdAt', d.created_at
            )
          ) FILTER (WHERE d.id IS NOT NULL),
          '[]'
        ) as departments
      FROM organizations o
      LEFT JOIN departments d ON d.organization_id = o.id
      WHERE o.id = $1
      GROUP BY o.id
    `;
    const result = await pool.query(query, [id]);
    if (result.rows[0]) {
      result.rows[0].departments = typeof result.rows[0].departments === 'string' 
        ? JSON.parse(result.rows[0].departments) 
        : result.rows[0].departments;
    }
    return result.rows[0];
  }
}

module.exports = Organization;

