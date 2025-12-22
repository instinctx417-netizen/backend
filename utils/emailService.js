/**
 * Email Service
 * Centralized email sending service using AWS SES via SMTP
 */

const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

// Email configuration from environment variables
const EMAIL_CONFIG = {
  host: process.env.AWS_SES_SMTP_HOST,
  port: parseInt(process.env.AWS_SES_SMTP_PORT || '587', 10),
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.AWS_SES_SMTP_USERNAME,
    pass: process.env.AWS_SES_SMTP_PASSWORD,
  },
};

const EMAIL_FROM = process.env.EMAIL_FROM || 'noreply@instinctx.com';
const EMAIL_FROM_NAME = process.env.EMAIL_FROM_NAME || 'InstinctX';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Email sending enabled/disabled flag (default: true for production, set to false for testing)
const ENABLE_EMAILS = process.env.ENABLE_EMAILS !== 'false' && process.env.ENABLE_EMAILS !== '0';

// Create reusable transporter
let transporter = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport(EMAIL_CONFIG);
  }
  return transporter;
}

/**
 * Load email template and replace placeholders
 * @param {string} templateName - Name of the template file (without .html)
 * @param {Object} variables - Variables to replace in template
 * @returns {string} - Rendered HTML
 */
function loadTemplate(templateName, variables = {}) {
  try {
    const templatePath = path.join(__dirname, '..', 'templates', 'email', `${templateName}.html`);
    let html = fs.readFileSync(templatePath, 'utf8');
    
    // Simple template replacement (using {{variable}} syntax)
    // Replace all {{variable}} with actual values
    Object.keys(variables).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      html = html.replace(regex, variables[key] || '');
    });
    
    // Handle conditional blocks {{#if variable}}...{{/if}}
    // Simple implementation - remove blocks if variable is falsy
    html = html.replace(/{{#if\s+(\w+)}}([\s\S]*?){{\/if}}/g, (match, varName, content) => {
      return variables[varName] ? content : '';
    });
    
    return html;
  } catch (error) {
    console.error(`Error loading email template ${templateName}:`, error);
    throw error;
  }
}

/**
 * Send email
 * @param {Object} options - Email options
 * @param {string|Array<string>} options.to - Recipient email(s)
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML content
 * @param {string} options.text - Plain text content (optional)
 * @returns {Promise<Object>} - Send result
 */
async function sendEmail({ to, subject, html, text }) {
  // Check if email sending is disabled
  if (!ENABLE_EMAILS) {
    console.log(`[EMAIL DISABLED - ENV] Would send email to: ${Array.isArray(to) ? to.join(', ') : to}, Subject: ${subject}`);
    return { success: true, messageId: 'disabled', skipped: true };
  }

  try {
    const mailOptions = {
      from: `"${EMAIL_FROM_NAME}" <${EMAIL_FROM}>`,
      to: Array.isArray(to) ? to.join(', ') : to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ''), // Strip HTML for text version
    };

    const info = await getTransporter().sendMail(mailOptions);
    console.log('Email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send email using a template
 * @param {string|Array<string>} to - Recipient email(s)
 * @param {string} templateName - Template name (without .html)
 * @param {Object} variables - Template variables
 * @param {string} subject - Email subject
 * @returns {Promise<Object>} - Send result
 */
async function sendTemplatedEmail(to, templateName, variables, subject) {
  try {
    const html = loadTemplate(templateName, variables);
    return await sendEmail({ to, subject, html });
  } catch (error) {
    console.error(`Error sending templated email ${templateName}:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Helper functions for specific notification types
 */
const EmailHelpers = {
  /**
   * Send invitation sent email to admin
   */
  async sendInvitationSentEmail(adminEmail, adminName, invitedEmail, invitedRole) {
    return sendTemplatedEmail(
      adminEmail,
      'invitationSent',
      {
        adminName: adminName || 'Admin',
        invitedEmail,
        invitedRole,
        dashboardLink: `${FRONTEND_URL}/admin/dashboard/invitations`,
      },
      'New Invitation Sent - InstinctX'
    );
  },

  /**
   * Send invitation approved email
   */
  async sendInvitationApprovedEmail(userEmail, userName, organizationName, signupLink) {
    return sendTemplatedEmail(
      userEmail,
      'invitationApproved',
      {
        userName: userName || 'User',
        organizationName,
        signupLink,
      },
      'Invitation Approved - InstinctX'
    );
  },

  /**
   * Send invitation rejected email
   */
  async sendInvitationRejectedEmail(userEmail, userName, organizationName) {
    return sendTemplatedEmail(
      userEmail,
      'invitationRejected',
      {
        userName: userName || 'User',
        organizationName,
      },
      'Invitation Rejected - InstinctX'
    );
  },

  /**
   * Send job request assigned email to HR
   */
  async sendJobRequestAssignedEmail(hrEmail, hrName, jobRequestTitle, organizationName, departmentName, jobRequestId) {
    return sendTemplatedEmail(
      hrEmail,
      'jobRequestAssigned',
      {
        hrName: hrName || 'HR User',
        jobRequestTitle,
        organizationName,
        departmentName: departmentName || '',
        dashboardLink: `${FRONTEND_URL}/hr/dashboard/job-requests`,
      },
      `New Job Request Assigned: ${jobRequestTitle} - InstinctX`
    );
  },

  /**
   * Send candidates delivered email
   */
  async sendCandidatesDeliveredEmail(userEmail, userName, jobRequestTitle, candidateCount, jobRequestId, userType = 'client') {
    const dashboardLink = userType === 'client' 
      ? `${FRONTEND_URL}/dashboard/job-requests/detail?jobRequestId=${jobRequestId}`
      : `${FRONTEND_URL}/admin/dashboard/job-requests`;
    
    return sendTemplatedEmail(
      userEmail,
      'candidatesDelivered',
      {
        userName: userName || 'User',
        jobRequestTitle,
        candidateCount: candidateCount.toString(),
        dashboardLink,
      },
      `${candidateCount} New Candidate(s) Ready for Review - InstinctX`
    );
  },

  /**
   * Send interview scheduled email
   */
  async sendInterviewScheduledEmail(userEmail, userName, interviewTitle, scheduledDate, meetingLink, meetingPlatform, userType = 'client') {
    const dashboardLink = userType === 'client'
      ? `${FRONTEND_URL}/dashboard/interviews`
      : userType === 'hr'
      ? `${FRONTEND_URL}/hr/dashboard/interviews`
      : `${FRONTEND_URL}/admin/dashboard/interviews`;
    
    return sendTemplatedEmail(
      userEmail,
      'interviewScheduled',
      {
        userName: userName || 'User',
        interviewTitle,
        scheduledDate,
        meetingLink: meetingLink || '',
        meetingPlatform: meetingPlatform || '',
        dashboardLink,
      },
      `Interview Scheduled: ${interviewTitle} - InstinctX`
    );
  },

  /**
   * Send organization activated email
   */
  async sendOrganizationActivatedEmail(userEmail, userName, organizationName, userType = 'client') {
    const dashboardLink = userType === 'client'
      ? `${FRONTEND_URL}/dashboard`
      : `${FRONTEND_URL}/admin/dashboard`;
    
    return sendTemplatedEmail(
      userEmail,
      'organizationActivated',
      {
        userName: userName || 'User',
        organizationName,
        dashboardLink,
      },
      `Organization Activated: ${organizationName} - InstinctX`
    );
  },

  /**
   * Send organization deactivated email
   */
  async sendOrganizationDeactivatedEmail(userEmail, userName, organizationName) {
    return sendTemplatedEmail(
      userEmail,
      'organizationDeactivated',
      {
        userName: userName || 'User',
        organizationName,
      },
      `Organization Deactivated: ${organizationName} - InstinctX`
    );
  },

  /**
   * Send job request created email to admin
   */
  async sendJobRequestCreatedEmail(adminEmail, adminName, jobRequestTitle, organizationName, departmentName, jobRequestId) {
    return sendTemplatedEmail(
      adminEmail,
      'jobRequestCreated',
      {
        adminName: adminName || 'Admin',
        jobRequestTitle,
        organizationName,
        departmentName: departmentName || '',
        dashboardLink: `${FRONTEND_URL}/admin/dashboard/job-requests`,
      },
      `New Job Request: ${jobRequestTitle} - InstinctX`
    );
  },

  /**
   * Send candidate selected email
   */
  async sendCandidateSelectedEmail(userEmail, userName, candidateName, jobRequestTitle, status, jobRequestId, userType = 'client') {
    const dashboardLink = userType === 'client'
      ? `${FRONTEND_URL}/dashboard/job-requests/detail?jobRequestId=${jobRequestId}`
      : `${FRONTEND_URL}/admin/dashboard/job-requests`;
    
    return sendTemplatedEmail(
      userEmail,
      'candidateSelected',
      {
        userName: userName || 'User',
        candidateName,
        jobRequestTitle,
        status,
        dashboardLink,
      },
      `Candidate Status Update: ${candidateName} - InstinctX`
    );
  },
};

module.exports = {
  sendEmail,
  sendTemplatedEmail,
  ...EmailHelpers,
};

