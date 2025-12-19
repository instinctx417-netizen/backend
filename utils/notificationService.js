/**
 * Notification Service
 * Centralized service for creating notifications with real-time Socket.io support
 * Use this instead of Notification.create() directly to enable real-time notifications
 */

const Notification = require('../models/Notification');
const { emitNotificationToUser, emitUnreadCountUpdate } = require('./socket');

/**
 * Create a notification and emit real-time event
 * @param {Object} req - Express request object (to get Socket.io instance)
 * @param {Object} notificationData - Notification data
 * @returns {Promise<Object>} Created notification
 */
async function createNotification(req, notificationData) {
  // Create notification in database
  const notification = await Notification.create(notificationData);

  // Emit real-time event if Socket.io is available
  const io = req.app.get('io');
  if (io) {
    emitNotificationToUser(io, notificationData.userId, {
      id: notification.id,
      userId: notification.user_id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      relatedEntityType: notification.related_entity_type,
      relatedEntityId: notification.related_entity_id,
      read: notification.read || false,
      createdAt: notification.created_at,
    });

    // Update unread count
    const unreadCount = await Notification.getUnreadCount(notificationData.userId);
    emitUnreadCountUpdate(io, notificationData.userId, unreadCount);
  }

  return notification;
}

/**
 * Create notifications for multiple users
 * @param {Object} req - Express request object
 * @param {Array<number>} userIds - Array of user IDs
 * @param {Object} notificationData - Notification data (without userId)
 * @returns {Promise<Array>} Created notifications
 */
async function createNotificationsForUsers(req, userIds, notificationData) {
  const notifications = [];
  
  for (const userId of userIds) {
    const notification = await createNotification(req, {
      ...notificationData,
      userId,
    });
    notifications.push(notification);
  }

  return notifications;
}

/**
 * Helper functions for common notification types
 */
const NotificationHelpers = {
  /**
   * Notify about job request assignment
   */
  async notifyJobRequestAssigned(req, hrUserId, jobRequestId, jobRequestTitle) {
    return createNotification(req, {
      userId: hrUserId,
      type: 'job_request_assigned',
      title: 'Job Request Assigned',
      message: `You have been assigned to job request "${jobRequestTitle}".`,
      relatedEntityType: 'job_request',
      relatedEntityId: jobRequestId,
    });
  },

  /**
   * Notify about candidate delivery
   */
  async notifyCandidatesDelivered(req, userId, jobRequestId, jobRequestTitle, count) {
    return createNotification(req, {
      userId,
      type: 'candidates_delivered',
      title: 'New Candidates Ready for Review',
      message: `${count} new candidate(s) have been delivered for ${jobRequestTitle}`,
      relatedEntityType: 'job_request',
      relatedEntityId: jobRequestId,
    });
  },

  /**
   * Notify about interview scheduled
   */
  async notifyInterviewScheduled(req, userId, interviewId, interviewTitle) {
    return createNotification(req, {
      userId,
      type: 'interview_scheduled',
      title: 'Interview Scheduled',
      message: `An interview "${interviewTitle}" has been scheduled.`,
      relatedEntityType: 'interview',
      relatedEntityId: interviewId,
    });
  },

  /**
   * Notify organization users about activation
   */
  async notifyOrganizationActivated(req, userIds, organizationId, organizationName) {
    return createNotificationsForUsers(req, userIds, {
      type: 'organization_activated',
      title: 'Organization Activated',
      message: `Your organization "${organizationName}" has been activated. You can now access all features.`,
      relatedEntityType: 'organization',
      relatedEntityId: organizationId,
    });
  },

  /**
   * Notify organization users about deactivation
   */
  async notifyOrganizationDeactivated(req, userIds, organizationId, organizationName) {
    return createNotificationsForUsers(req, userIds, {
      type: 'organization_deactivated',
      title: 'Organization Deactivated',
      message: `Your organization "${organizationName}" has been deactivated. Please contact support for assistance.`,
      relatedEntityType: 'organization',
      relatedEntityId: organizationId,
    });
  },

  /**
   * Notify about invitation sent
   */
  async notifyInvitationSent(req, adminUserIds, invitationId, email, organizationName) {
    return createNotificationsForUsers(req, adminUserIds, {
      type: 'invitation_sent',
      title: 'New Invitation Requires Approval',
      message: `An invitation has been sent to ${email} for organization "${organizationName}". Please review and approve.`,
      relatedEntityType: 'invitation',
      relatedEntityId: invitationId,
    });
  },

  /**
   * Notify about invitation approved
   */
  async notifyInvitationApproved(req, invitedByUserId, invitationId, email) {
    return createNotification(req, {
      userId: invitedByUserId,
      type: 'invitation_approved',
      title: 'Invitation Approved',
      message: `The invitation sent to ${email} has been approved by admin.`,
      relatedEntityType: 'invitation',
      relatedEntityId: invitationId,
    });
  },

  /**
   * Notify about invitation rejected
   */
  async notifyInvitationRejected(req, invitedByUserId, invitationId, email) {
    return createNotification(req, {
      userId: invitedByUserId,
      type: 'invitation_rejected',
      title: 'Invitation Rejected',
      message: `The invitation sent to ${email} has been rejected by admin.`,
      relatedEntityType: 'invitation',
      relatedEntityId: invitationId,
    });
  },

  /**
   * Notify about invitation accepted
   */
  async notifyInvitationAccepted(req, invitedByUserId, invitationId, email, organizationName) {
    return createNotification(req, {
      userId: invitedByUserId,
      type: 'invitation_accepted',
      title: 'Invitation Accepted',
      message: `${email} has accepted the invitation and joined "${organizationName}".`,
      relatedEntityType: 'invitation',
      relatedEntityId: invitationId,
    });
  },

  /**
   * Notify admins about new job request
   */
  async notifyJobRequestCreated(req, adminUserIds, jobRequestId, jobRequestTitle, organizationName) {
    return createNotificationsForUsers(req, adminUserIds, {
      type: 'job_request_received',
      title: 'New Job Request',
      message: `A new job request "${jobRequestTitle}" has been created for "${organizationName}". Please assign HR.`,
      relatedEntityType: 'job_request',
      relatedEntityId: jobRequestId,
    });
  },

  /**
   * Notify about job request update
   */
  async notifyJobRequestUpdated(req, userIds, jobRequestId, jobRequestTitle) {
    return createNotificationsForUsers(req, userIds, {
      type: 'job_request_updated',
      title: 'Job Request Updated',
      message: `Job request "${jobRequestTitle}" has been updated.`,
      relatedEntityType: 'job_request',
      relatedEntityId: jobRequestId,
    });
  },

  /**
   * Notify about candidate selection
   */
  async notifyCandidateSelected(req, userIds, candidateId, candidateName, jobRequestId, jobRequestTitle) {
    return createNotificationsForUsers(req, userIds, {
      type: 'candidate_selected',
      title: 'Candidate Selected',
      message: `${candidateName} has been selected for job request "${jobRequestTitle}".`,
      relatedEntityType: 'candidate',
      relatedEntityId: candidateId,
    });
  },

  /**
   * Notify about interview update
   */
  async notifyInterviewUpdated(req, userIds, interviewId, interviewTitle) {
    return createNotificationsForUsers(req, userIds, {
      type: 'interview_updated',
      title: 'Interview Updated',
      message: `Interview "${interviewTitle}" has been updated.`,
      relatedEntityType: 'interview',
      relatedEntityId: interviewId,
    });
  },

  /**
   * Notify about interview cancellation
   */
  async notifyInterviewCancelled(req, userIds, interviewId, interviewTitle) {
    return createNotificationsForUsers(req, userIds, {
      type: 'interview_cancelled',
      title: 'Interview Cancelled',
      message: `Interview "${interviewTitle}" has been cancelled.`,
      relatedEntityType: 'interview',
      relatedEntityId: interviewId,
    });
  },
};

module.exports = {
  createNotification,
  createNotificationsForUsers,
  ...NotificationHelpers,
};

