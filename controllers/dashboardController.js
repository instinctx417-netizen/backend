const JobRequest = require('../models/JobRequest');
const Candidate = require('../models/Candidate');
const Interview = require('../models/Interview');
const Department = require('../models/Department');
const UserOrganization = require('../models/UserOrganization');
const pool = require('../config/database');

/**
 * Get department-based status dashboard
 */
exports.getDepartmentStatusDashboard = async (req, res) => {
  try {
    const { organizationId } = req.params;

    // Verify user has access
    const userOrg = await UserOrganization.findByUserAndOrganization(req.userId, organizationId);
    if (!userOrg) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this organization',
      });
    }

    // Get all departments with their job requests and statuses
    const query = `
      SELECT 
        d.id as department_id,
        d.name as department_name,
        COUNT(DISTINCT jr.id) as total_jobs,
        COUNT(DISTINCT jr.id) FILTER (WHERE jr.status = 'received') as received_count,
        COUNT(DISTINCT jr.id) FILTER (WHERE jr.status = 'assigned_to_hr') as assigned_count,
        COUNT(DISTINCT jr.id) FILTER (WHERE jr.status = 'shortlisting') as shortlisting_count,
        COUNT(DISTINCT jr.id) FILTER (WHERE jr.status = 'candidates_delivered') as candidates_delivered_count,
        COUNT(DISTINCT jr.id) FILTER (WHERE jr.status = 'interviews_scheduled') as interviews_scheduled_count,
        COUNT(DISTINCT jr.id) FILTER (WHERE jr.status = 'selection_pending') as selection_pending_count,
        COUNT(DISTINCT jr.id) FILTER (WHERE jr.status = 'hired') as hired_count,
        COUNT(DISTINCT i.id) FILTER (WHERE i.status = 'completed') as interviews_completed,
        COUNT(DISTINCT i.id) FILTER (WHERE i.status IN ('scheduled', 'confirmed')) as interviews_pending,
        MAX(jr.last_reminder_sent_at) as last_reminder_sent
      FROM departments d
      LEFT JOIN job_requests jr ON jr.department_id = d.id
      LEFT JOIN interviews i ON i.job_request_id = jr.id
      WHERE d.organization_id = $1
      GROUP BY d.id, d.name
      ORDER BY d.name
    `;

    const result = await pool.query(query, [organizationId]);
    const departments = result.rows.map(row => ({
      departmentId: row.department_id,
      departmentName: row.department_name,
      totalJobs: parseInt(row.total_jobs) || 0,
      statusBreakdown: {
        received: parseInt(row.received_count) || 0,
        assigned: parseInt(row.assigned_count) || 0,
        shortlisting: parseInt(row.shortlisting_count) || 0,
        candidatesDelivered: parseInt(row.candidates_delivered_count) || 0,
        interviewsScheduled: parseInt(row.interviews_scheduled_count) || 0,
        selectionPending: parseInt(row.selection_pending_count) || 0,
        hired: parseInt(row.hired_count) || 0,
      },
      interviews: {
        completed: parseInt(row.interviews_completed) || 0,
        pending: parseInt(row.interviews_pending) || 0,
      },
      lastReminderSent: row.last_reminder_sent,
    }));

    // Get jobs awaiting client selection (for auto-reminder)
    const pendingSelectionQuery = `
      SELECT 
        jr.id,
        jr.title,
        jr.department_id,
        d.name as department_name,
        jr.status,
        jr.candidates_delivered_at,
        jr.last_reminder_sent_at,
        EXTRACT(EPOCH FROM (NOW() - jr.candidates_delivered_at)) / 86400 as days_since_delivery
      FROM job_requests jr
      JOIN departments d ON d.id = jr.department_id
      WHERE jr.organization_id = $1
        AND jr.status = 'selection_pending'
        AND jr.candidates_delivered_at IS NOT NULL
      ORDER BY jr.candidates_delivered_at ASC
    `;

    const pendingResult = await pool.query(pendingSelectionQuery, [organizationId]);
    const pendingSelections = pendingResult.rows.map(row => {
      const daysSinceDelivery = parseFloat(row.days_since_delivery) || 0;
      let daysSinceLastReminder = 0;
      
      if (row.last_reminder_sent_at) {
        const lastReminderDate = new Date(row.last_reminder_sent_at);
        const now = new Date();
        daysSinceLastReminder = (now - lastReminderDate) / (1000 * 60 * 60 * 24);
      }
      
      return {
        jobRequestId: row.id,
        title: row.title,
        departmentId: row.department_id,
        departmentName: row.department_name,
        daysSinceDelivery,
        needsReminder: daysSinceDelivery >= 4 && (!row.last_reminder_sent_at || daysSinceLastReminder >= 4),
      };
    });

    res.json({
      success: true,
      data: {
        departments,
        pendingSelections,
      },
    });
  } catch (error) {
    console.error('Get department status dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

