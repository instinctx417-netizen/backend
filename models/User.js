const pool = require('../config/database');
const bcrypt = require('bcryptjs');

class User {
  /**
   * Create a new user with all form data
   */
  static async create(userData) {
    const {
      email, password, firstName, lastName, userType,
      // Client fields
      companyName, industry, companySize, contactName, phone,
      hireType, engagementType, timeline, jobFunctions, specificNeeds, heardFrom,
      // Candidate fields
      fullName, location, country, timezone, primaryFunction, yearsExperience,
      currentRole, education, englishProficiency, availability,
      linkedIn, portfolio, whyInstinctX, startupExperience, resumePath
    } = userData;
    
    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    
    // Convert jobFunctions array to JSON if provided
    const jobFunctionsJson = jobFunctions ? JSON.stringify(jobFunctions) : null;
    
    const query = `
      INSERT INTO users (
        email, password_hash, first_name, last_name, user_type,
        company_name, industry, company_size, contact_name, phone,
        hire_type, engagement_type, timeline, job_functions, specific_needs, heard_from,
        full_name, location, country, timezone, primary_function, years_experience,
        "current_role", education, english_proficiency, availability,
        linkedin_url, portfolio_url, why_instinctx, startup_experience, resume_path,
        created_at, updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16,
        $17, $18, $19, $20, $21, $22,
        $23, $24, $25, $26,
        $27, $28, $29, $30, $31,
        NOW(), NOW()
      )
      RETURNING *
    `;
    
    // Normalize email: trim and lowercase before storing
    const normalizedEmail = email ? email.trim().toLowerCase() : email;
    
    const values = [
      normalizedEmail, hashedPassword, firstName, lastName, userType,
      companyName || null, industry || null, companySize || null, contactName || null, phone || null,
      hireType || null, engagementType || null, timeline || null, jobFunctionsJson, specificNeeds || null, heardFrom || null,
      fullName || null, location || null, country || null, timezone || null, primaryFunction || null, yearsExperience || null,
      currentRole || null, education || null, englishProficiency || null, availability || null,
      linkedIn || null, portfolio || null, whyInstinctX || null, startupExperience || null, resumePath || null
    ];
    
    const result = await pool.query(query, values);
    return result.rows[0];
  }

  /**
   * Find user by email (case-insensitive)
   */
  static async findByEmail(email) {
    if (!email) {
      return null;
    }
    // Normalize email: trim and lowercase
    const normalizedEmail = email.trim().toLowerCase();
    const query = 'SELECT * FROM users WHERE LOWER(TRIM(email)) = $1 LIMIT 1';
    const result = await pool.query(query, [normalizedEmail]);
    return result.rows[0] || null;
  }

  /**
   * Find user by ID
   */
  static async findById(id) {
    const query = 'SELECT * FROM users WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  /**
   * Verify password
   */
  static async verifyPassword(plainPassword, hashedPassword) {
    return await bcrypt.compare(plainPassword, hashedPassword);
  }

  /**
   * Update user password
   */
  static async updatePassword(userId, newPassword) {
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
    
    const query = `
      UPDATE users 
      SET password_hash = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING id
    `;
    
    const result = await pool.query(query, [hashedPassword, userId]);
    return result.rows[0];
  }

  /**
   * Update user profile
   */
  static async updateProfile(userId, updateData) {
    const { firstName, lastName } = updateData;
    const query = `
      UPDATE users 
      SET first_name = COALESCE($1, first_name),
          last_name = COALESCE($2, last_name),
          updated_at = NOW()
      WHERE id = $3
      RETURNING id, email, first_name, last_name, user_type, created_at, updated_at
    `;
    
    const result = await pool.query(query, [firstName, lastName, userId]);
    return result.rows[0];
  }

  /**
   * Find users by type
   */
  static async findByType(userType) {
    const query = 'SELECT * FROM users WHERE user_type = $1 ORDER BY created_at DESC';
    const result = await pool.query(query, [userType]);
    return result.rows;
  }
}

module.exports = User;

