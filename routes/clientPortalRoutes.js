const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware');

// Controllers
const organizationController = require('../controllers/organizationController');
const jobRequestController = require('../controllers/jobRequestController');
const candidateController = require('../controllers/candidateController');
const interviewController = require('../controllers/interviewController');
const invitationController = require('../controllers/invitationController');
const notificationController = require('../controllers/notificationController');
const adminController = require('../controllers/adminController');
const analyticsController = require('../controllers/analyticsController');
const dashboardController = require('../controllers/dashboardController');

// Public routes (no authentication required)
// Get invitation by token (for signup page - users are not logged in yet)
router.get('/invitations/token/:token', invitationController.getByToken);

// All other routes require authentication
router.use(authenticate);

// Organization routes
router.post('/organizations', organizationController.create);
router.get('/organizations', organizationController.getUserOrganizations);
router.get('/organizations/:id', organizationController.getById);
router.get('/organizations/:organizationId/users', organizationController.getOrganizationUsers);
router.post('/organizations/:organizationId/departments', organizationController.createDepartment);
router.get('/organizations/:organizationId/departments', organizationController.getDepartments);

// Job Request routes
router.post('/organizations/:organizationId/job-requests', jobRequestController.create);
router.get('/organizations/:organizationId/job-requests', jobRequestController.getByOrganization);
router.get('/organizations/:organizationId/job-requests/statistics', jobRequestController.getStatistics);
router.get('/departments/:departmentId/job-requests', jobRequestController.getByDepartment);
router.get('/job-requests/:id', jobRequestController.getById);
router.put('/job-requests/:id', jobRequestController.update);

// Candidate routes
router.get('/job-requests/:jobRequestId/candidates', candidateController.getByJobRequest);
router.get('/candidates/:id', candidateController.getById);
router.put('/candidates/:id/status', candidateController.updateStatus);
// Candidate user profile (admin & HR only, shared endpoint)
router.get('/candidate-users/:id', candidateController.getCandidateUserDetails);

// Interview routes
router.post('/interviews', interviewController.create);
router.get('/interviews/:id', interviewController.getById);
router.get('/job-requests/:jobRequestId/interviews', interviewController.getByJobRequest);
router.get('/organizations/:organizationId/interviews/upcoming', interviewController.getUpcoming);
router.get('/organizations/:organizationId/interviews', interviewController.getByOrganization);
router.get('/interviews/participant/me', interviewController.getByParticipant);
router.put('/interviews/:id', interviewController.update);
router.post('/interviews/:id/participants', interviewController.addParticipant);
router.delete('/interviews/:id/participants/:userId', interviewController.removeParticipant);

// Invitation routes
router.post('/organizations/:organizationId/invitations', invitationController.create);
router.get('/organizations/:organizationId/invitations', invitationController.getByOrganization);

// Notification routes
router.post('/notifications', notificationController.create);
router.get('/notifications', notificationController.getUserNotifications);
router.get('/notifications/unread-count', notificationController.getUnreadCount);
router.put('/notifications/:id/read', notificationController.markAsRead);
router.put('/notifications/read-all', notificationController.markAllAsRead);

// Dashboard routes
router.get('/organizations/:organizationId/dashboard/departments', dashboardController.getDepartmentStatusDashboard);

// Analytics routes
router.get('/organizations/:organizationId/analytics', analyticsController.getOrganizationAnalytics);

// Admin routes (these should have admin middleware in production)
router.post('/admin/job-requests/:jobRequestId/candidates', adminController.deliverCandidates);
router.post('/admin/job-requests/:jobRequestId/assign-hr', adminController.assignHrToJobRequest);

// Admin user management routes
router.post('/admin/hr-users', adminController.createHR);
router.get('/admin/hr-users', adminController.getHRUsers);

// Admin invitation management routes
router.get('/admin/invitations', adminController.getInvitations);
router.post('/admin/invitations/:invitationId/approve', adminController.approveInvitation);
router.post('/admin/invitations/:invitationId/reject', adminController.rejectInvitation);
router.get('/admin/invitations/:invitationId/link', adminController.getInvitationLink);

// Admin routes
router.get('/admin/job-requests', adminController.getAllJobRequests);
router.get('/admin/organizations', adminController.getAllOrganizations);
router.post('/admin/organizations/:organizationId/activate', adminController.activateOrganization);
router.post('/admin/organizations/:organizationId/deactivate', adminController.deactivateOrganization);
router.get('/admin/candidates', adminController.getCandidateUsers);
router.get('/admin/interviews', interviewController.getAll);

// HR routes
const hrController = require('../controllers/hrController');
router.get('/hr/job-requests', hrController.getAssignedJobRequests);
router.get('/hr/candidates', hrController.getCandidateUsers);
router.post('/hr/job-requests/:jobRequestId/candidates', hrController.pushCandidates);
router.get('/hr/dashboard/stats', hrController.getDashboardStats);
router.get('/hr/interviews', interviewController.getByAssignedHR);

module.exports = router;

