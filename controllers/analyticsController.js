const pool = require('../config/database');
const JobRequest = require('../models/JobRequest');
const Candidate = require('../models/Candidate');
const Interview = require('../models/Interview');
const UserOrganization = require('../models/UserOrganization');

/**
 * Get analytics for organization
 */
exports.getOrganizationAnalytics = async (req, res) => {
  try {
    const { organizationId } = req.params;
    const { departmentId } = req.query;

    // Verify user has access
    const userOrg = await UserOrganization.findByUserAndOrganization(req.userId, organizationId);
    if (!userOrg) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this organization',
      });
    }

    // Time-to-fill statistics
    const timeToFillQuery = `
      SELECT 
        AVG(EXTRACT(EPOCH FROM (candidates_delivered_at - created_at)) / 86400) as avg_days_to_delivery,
        AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 86400) as avg_days_to_fill,
        COUNT(*) FILTER (WHERE status = 'hired') as total_hired,
        COUNT(*) as total_jobs
      FROM job_requests
      WHERE organization_id = $1
      ${departmentId ? 'AND department_id = $2' : ''}
    `;

    const params = departmentId ? [organizationId, departmentId] : [organizationId];
    const timeToFillResult = await pool.query(timeToFillQuery, params);
    const timeToFill = timeToFillResult.rows[0];

    // Candidate conversion rates
    const conversionQuery = `
      SELECT 
        COUNT(DISTINCT c.id) as total_candidates,
        COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'hired') as hired_candidates,
        COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'selected') as selected_candidates,
        COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'interview_scheduled' OR c.status = 'interview_completed') as interviewed_candidates,
        COUNT(DISTINCT jr.id) as total_job_requests
      FROM job_requests jr
      LEFT JOIN candidates c ON c.job_request_id = jr.id
      WHERE jr.organization_id = $1
      ${departmentId ? 'AND jr.department_id = $2' : ''}
    `;

    const conversionResult = await pool.query(conversionQuery, params);
    const conversion = conversionResult.rows[0];

    // Calculate rates
    const conversionRates = {
      applicationToInterview: conversion.total_candidates > 0 
        ? ((conversion.interviewed_candidates / conversion.total_candidates) * 100).toFixed(1)
        : '0',
      interviewToSelection: conversion.interviewed_candidates > 0
        ? ((conversion.selected_candidates / conversion.interviewed_candidates) * 100).toFixed(1)
        : '0',
      selectionToHire: conversion.selected_candidates > 0
        ? ((conversion.hired_candidates / conversion.selected_candidates) * 100).toFixed(1)
        : '0',
      overallConversion: conversion.total_candidates > 0
        ? ((conversion.hired_candidates / conversion.total_candidates) * 100).toFixed(1)
        : '0',
    };

    // Department breakdown
    const departmentStatsQuery = `
      SELECT 
        d.id,
        d.name,
        COUNT(DISTINCT jr.id) as job_count,
        COUNT(DISTINCT c.id) as candidate_count,
        COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'hired') as hired_count,
        COUNT(DISTINCT i.id) as interview_count,
        AVG(EXTRACT(EPOCH FROM (jr.updated_at - jr.created_at)) / 86400) as avg_days_to_fill
      FROM departments d
      LEFT JOIN job_requests jr ON jr.department_id = d.id
      LEFT JOIN candidates c ON c.job_request_id = jr.id
      LEFT JOIN interviews i ON i.job_request_id = jr.id
      WHERE d.organization_id = $1
      GROUP BY d.id, d.name
      ORDER BY d.name
    `;

    const departmentStatsResult = await pool.query(departmentStatsQuery, [organizationId]);
    const departmentStats = departmentStatsResult.rows;

    // Status breakdown by department
    const statusByDepartmentQuery = `
      SELECT 
        d.name as department_name,
        jr.status,
        COUNT(*) as count
      FROM job_requests jr
      JOIN departments d ON d.id = jr.department_id
      WHERE jr.organization_id = $1
      GROUP BY d.name, jr.status
      ORDER BY d.name, jr.status
    `;

    const statusByDeptResult = await pool.query(statusByDepartmentQuery, [organizationId]);
    const statusByDepartment = statusByDeptResult.rows.reduce((acc, row) => {
      if (!acc[row.department_name]) {
        acc[row.department_name] = {};
      }
      acc[row.department_name][row.status] = parseInt(row.count);
      return acc;
    }, {});

    // ROI calculation (simplified - can be enhanced with actual cost data)
    const roiData = {
      totalHires: parseInt(conversion.hired_candidates) || 0,
      avgTimeToFill: parseFloat(timeToFill.avg_days_to_fill) || 0,
      // These would be calculated with actual cost data
      estimatedSavings: null,
      costPerHire: null,
    };

    res.json({
      success: true,
      data: {
        timeToFill: {
          avgDaysToDelivery: parseFloat(timeToFill.avg_days_to_delivery) || 0,
          avgDaysToFill: parseFloat(timeToFill.avg_days_to_fill) || 0,
          totalHired: parseInt(timeToFill.total_hired) || 0,
          totalJobs: parseInt(timeToFill.total_jobs) || 0,
        },
        conversionRates,
        departmentStats,
        statusByDepartment,
        roi: roiData,
      },
    });
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};




