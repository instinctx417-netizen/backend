const pool = require('../config/database');
const fs = require('fs');
const path = require('path');

/**
 * Run database migrations
 */
async function runMigrations() {
  try {
    // Run migration 001
    const migration1 = path.join(__dirname, '..', 'migrations', '001_create_users_table.sql');
    const sql1 = fs.readFileSync(migration1, 'utf8');
    await pool.query(sql1);
    console.log('✅ Migration 001 completed: users table created');

    // Run migration 002
    const migration2 = path.join(__dirname, '..', 'migrations', '002_add_user_profile_fields.sql');
    const sql2 = fs.readFileSync(migration2, 'utf8');
    await pool.query(sql2);
    console.log('✅ Migration 002 completed: profile fields added');

    // Run migration 003
    const migration3 = path.join(__dirname, '..', 'migrations', '003_create_client_portal_schema.sql');
    const sql3 = fs.readFileSync(migration3, 'utf8');
    await pool.query(sql3);
    console.log('✅ Migration 003 completed: client portal schema created');

    // Run migration 004
    const migration4 = path.join(__dirname, '..', 'migrations', '004_add_admin_hr_users.sql');
    const sql4 = fs.readFileSync(migration4, 'utf8');
    await pool.query(sql4);
    console.log('✅ Migration 004 completed: admin and HR users added');

    // Run migration 005
    const migration5 = path.join(__dirname, '..', 'migrations', '005_add_organization_status.sql');
    const sql5 = fs.readFileSync(migration5, 'utf8');
    await pool.query(sql5);
    console.log('✅ Migration 005 completed: organization status column added');

    // Run migration 006
    const migration6 = path.join(__dirname, '..', 'migrations', '006_remove_organization_name_unique.sql');
    const sql6 = fs.readFileSync(migration6, 'utf8');
    await pool.query(sql6);
    console.log('✅ Migration 006 completed: organization name unique constraint removed');

    // Run migration 007
    const migration7 = path.join(__dirname, '..', 'migrations', '007_remove_invitation_department.sql');
    const sql7 = fs.readFileSync(migration7, 'utf8');
    await pool.query(sql7);
    console.log('✅ Migration 007 completed: department_id removed from user_invitations and user_organizations');

    // Run migration 008
    const migration8 = path.join(__dirname, '..', 'migrations', '008_add_candidate_file_fields.sql');
    const sql8 = fs.readFileSync(migration8, 'utf8');
    await pool.query(sql8);
    console.log('✅ Migration 008 completed: candidate file path fields added');

    // Run migration 009
    const migration9 = path.join(__dirname, '..', 'migrations', '009_add_notification_types.sql');
    const sql9 = fs.readFileSync(migration9, 'utf8');
    await pool.query(sql9);
    console.log('✅ Migration 009 completed: notification types added');

    // Run migration 010
    const migration10 = path.join(__dirname, '..', 'migrations', '010_create_interview_logs.sql');
    const sql10 = fs.readFileSync(migration10, 'utf8');
    await pool.query(sql10);
    console.log('✅ Migration 010 completed: interview_logs table created');

    // Run migration 011
    const migration11 = path.join(__dirname, '..', 'migrations', '011_create_invitation_logs.sql');
    const sql11 = fs.readFileSync(migration11, 'utf8');
    await pool.query(sql11);
    console.log('✅ Migration 011 completed: invitation_logs table created');

    // Run migration 012
    const migration12 = path.join(__dirname, '..', 'migrations', '012_create_site_staff.sql');
    const sql12 = fs.readFileSync(migration12, 'utf8');
    await pool.query(sql12);
    console.log('✅ Migration 012 completed: site_staff table created');

    // Run migration 013
    const migration13 = path.join(__dirname, '..', 'migrations', '013_add_hired_action_type.sql');
    const sql13 = fs.readFileSync(migration13, 'utf8');
    await pool.query(sql13);
    console.log('✅ Migration 013 completed: hired action type added to interview_logs');

    // Run migration 014
    const migration14 = path.join(__dirname, '..', 'migrations', '014_add_staff_profile_data.sql');
    const sql14 = fs.readFileSync(migration14, 'utf8');
    await pool.query(sql14);
    console.log('✅ Migration 014 completed: staff profile_data column added');

    // Run migration 015
    const migration15 = path.join(__dirname, '..', 'migrations', '015_create_tickets.sql');
    const sql15 = fs.readFileSync(migration15, 'utf8');
    await pool.query(sql15);
    console.log('✅ Migration 015 completed: tickets and ticket_messages tables created');

    // Run migration 016
    const migration16 = path.join(__dirname, '..', 'migrations', '016_add_ticket_notification_types.sql');
    const sql16 = fs.readFileSync(migration16, 'utf8');
    await pool.query(sql16);
    console.log('✅ Migration 016 completed: ticket notification types added');

    // Run migration 017
    const migration17 = path.join(__dirname, '..', 'migrations', '017_create_training_tables.sql');
    const sql17 = fs.readFileSync(migration17, 'utf8');
    await pool.query(sql17);
    console.log('✅ Migration 017 completed: training and onboarding tables created');

    console.log('✅ All migrations completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  runMigrations()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = runMigrations;

