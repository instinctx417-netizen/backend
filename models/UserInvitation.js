const pool = require('../config/database');
const crypto = require('crypto');

class UserInvitation {
  /**
   * Create a new invitation
   */
  static async create(invitationData) {
    const {
      organizationId,
      invitedByUserId,
      email,
      role
    } = invitationData;

    // Generate unique token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

    const query = `
      INSERT INTO user_invitations (
        organization_id, invited_by_user_id, email, role,
        token, status, expires_at, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, 'pending', $6, NOW(), NOW())
      RETURNING *
    `;

    const result = await pool.query(query, [
      organizationId,
      invitedByUserId,
      email,
      role,
      token,
      expiresAt
    ]);

    return result.rows[0];
  }

  /**
   * Find invitation by token
   */
  static async findByToken(token) {
    const query = `
      SELECT 
        ui.*,
        o.name as organization_name,
        u.first_name as invited_by_first_name,
        u.last_name as invited_by_last_name
      FROM user_invitations ui
      JOIN organizations o ON o.id = ui.organization_id
      JOIN users u ON u.id = ui.invited_by_user_id
      WHERE ui.token = $1
    `;
    const result = await pool.query(query, [token]);
    return result.rows[0];
  }

  /**
   * Find invitations by organization
   */
  static async findByOrganization(organizationId) {
    const query = `
      SELECT 
        ui.*,
        u1.first_name as invited_by_first_name,
        u1.last_name as invited_by_last_name,
        u2.first_name as verified_by_first_name,
        u2.last_name as verified_by_last_name
      FROM user_invitations ui
      JOIN users u1 ON u1.id = ui.invited_by_user_id
      LEFT JOIN users u2 ON u2.id = ui.verified_by_admin_id
      WHERE ui.organization_id = $1
      ORDER BY ui.created_at DESC
    `;
    const result = await pool.query(query, [organizationId]);
    return result.rows;
  }

  /**
   * Find pending invitations
   */
  static async findPending() {
    const query = `
      SELECT 
        ui.*,
        o.name as organization_name,
        u.first_name as invited_by_first_name,
        u.last_name as invited_by_last_name
      FROM user_invitations ui
      JOIN organizations o ON o.id = ui.organization_id
      JOIN users u ON u.id = ui.invited_by_user_id
      WHERE ui.status = 'pending' AND ui.expires_at > NOW()
      ORDER BY ui.created_at DESC
    `;
    const result = await pool.query(query);
    return result.rows;
  }

  /**
   * Find approved invitations
   */
  static async findApproved() {
    const query = `
      SELECT 
        ui.*,
        o.name as organization_name,
        u.first_name as invited_by_first_name,
        u.last_name as invited_by_last_name
      FROM user_invitations ui
      JOIN organizations o ON o.id = ui.organization_id
      JOIN users u ON u.id = ui.invited_by_user_id
      WHERE ui.status = 'approved'
      ORDER BY ui.verified_at DESC, ui.created_at DESC
    `;
    const result = await pool.query(query);
    return result.rows;
  }

  /**
   * Find invitation by ID
   */
  static async findById(id) {
    const query = `
      SELECT 
        ui.*,
        o.name as organization_name,
        u1.first_name as invited_by_first_name,
        u1.last_name as invited_by_last_name
      FROM user_invitations ui
      JOIN organizations o ON o.id = ui.organization_id
      JOIN users u1 ON u1.id = ui.invited_by_user_id
      WHERE ui.id = $1
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  /**
   * Approve invitation (by admin)
   */
  static async approve(id, adminUserId) {
    const query = `
      UPDATE user_invitations 
      SET status = 'approved',
          verified_by_admin_id = $1,
          verified_at = NOW(),
          updated_at = NOW()
      WHERE id = $2 AND status = 'pending'
      RETURNING *
    `;
    const result = await pool.query(query, [adminUserId, id]);
    return result.rows[0];
  }

  /**
   * Reject invitation (by admin)
   */
  static async reject(id, adminUserId) {
    const query = `
      UPDATE user_invitations 
      SET status = 'rejected',
          verified_by_admin_id = $1,
          verified_at = NOW(),
          updated_at = NOW()
      WHERE id = $2 AND status = 'pending'
      RETURNING *
    `;
    const result = await pool.query(query, [adminUserId, id]);
    return result.rows[0];
  }

  /**
   * Mark invitation as accepted
   */
  static async accept(token) {
    const query = `
      UPDATE user_invitations 
      SET status = 'accepted',
          updated_at = NOW()
      WHERE token = $1 AND status = 'approved'
      RETURNING *
    `;
    const result = await pool.query(query, [token]);
    return result.rows[0];
  }

  /**
   * Check if invitation is valid
   */
  static async isValid(token) {
    const invitation = await this.findByToken(token);
    if (!invitation) return false;
    if (invitation.status !== 'approved') return false;
    if (new Date(invitation.expires_at) < new Date()) {
      // Mark as expired
      await pool.query(
        'UPDATE user_invitations SET status = $1 WHERE id = $2',
        ['expired', invitation.id]
      );
      return false;
    }
    return true;
  }
}

module.exports = UserInvitation;




