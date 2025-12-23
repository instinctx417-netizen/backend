/**
 * Notification Service
 * Centralized service for creating notifications with real-time Socket.io support
 * Use this instead of Notification.create() directly to enable real-time notifications
 */

const Notification = require('../models/Notification');
const User = require('../models/User');
const { emitNotificationToUser, emitUnreadCountUpdate } = require('./socket');
const emailService = require('./emailService');

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
  try {
    const io = req?.app?.get('io');
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
    } else {
      console.warn('Socket.io instance not available for notification emission');
    }
  } catch (error) {
    console.error('Error emitting notification via Socket.io:', error);
    // Don't fail the notification creation if socket emission fails
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
  async notifyJobRequestAssigned(req, hrUserId, jobRequestId, jobRequestTitle, organizationName, departmentName) {
    const notification = await createNotification(req, {
      userId: hrUserId,
      type: 'job_request_assigned',
      title: 'Job Request Assigned',
      message: `You have been assigned to job request "${jobRequestTitle}".`,
      relatedEntityType: 'job_request',
      relatedEntityId: jobRequestId,
    });

    // Send email notification
    try {
      const hrUser = await User.findById(hrUserId);
      if (hrUser && hrUser.email) {
        await emailService.sendJobRequestAssignedEmail(
          hrUser.email,
          `${hrUser.first_name} ${hrUser.last_name}`,
          jobRequestTitle,
          organizationName || '',
          departmentName || '',
          jobRequestId
        );
      }
    } catch (emailError) {
      console.error('Error sending job request assigned email:', emailError);
      // Don't fail notification if email fails
    }

    return notification;
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
   * Notify organization COO users about activation
   */
  async notifyOrganizationActivated(req, cooUserIds, organizationId, organizationName) {
    if (!cooUserIds || cooUserIds.length === 0) {
      return [];
    }

    const notifications = await createNotificationsForUsers(req, cooUserIds, {
      type: 'organization_activated',
      title: 'Organization Activated',
      message: `Your organization "${organizationName}" has been activated. You can now access all features.`,
      relatedEntityType: 'organization',
      relatedEntityId: organizationId,
    });

    // Send email notifications
    try {
      for (const userId of cooUserIds) {
        const user = await User.findById(userId);
        if (user && user.email) {
          await emailService.sendOrganizationActivatedEmail(
            user.email,
            `${user.first_name} ${user.last_name}`,
            organizationName,
            user.user_type
          );
        }
      }
    } catch (emailError) {
      console.error('Error sending organization activated emails:', emailError);
      // Don't fail notifications if email fails
    }

    return notifications;
  },

  /**
   * Notify organization COO users about deactivation
   */
  async notifyOrganizationDeactivated(req, cooUserIds, organizationId, organizationName) {
    if (!cooUserIds || cooUserIds.length === 0) {
      return [];
    }

    const notifications = await createNotificationsForUsers(req, cooUserIds, {
      type: 'organization_deactivated',
      title: 'Organization Deactivated',
      message: `Your organization "${organizationName}" has been deactivated. Please contact support for assistance.`,
      relatedEntityType: 'organization',
      relatedEntityId: organizationId,
    });

    // Send email notifications
    try {
      for (const userId of cooUserIds) {
        const user = await User.findById(userId);
        if (user && user.email) {
          await emailService.sendOrganizationDeactivatedEmail(
            user.email,
            `${user.first_name} ${user.last_name}`,
            organizationName
          );
        }
      }
    } catch (emailError) {
      console.error('Error sending organization deactivated emails:', emailError);
      // Don't fail notifications if email fails
    }

    return notifications;
  },

  /**
   * Notify about invitation sent
   */
  async notifyInvitationSent(req, adminUserIds, invitationId, email, organizationName, invitedRole) {
    const notifications = await createNotificationsForUsers(req, adminUserIds, {
      type: 'invitation_sent',
      title: 'New Invitation Requires Approval',
      message: `An invitation has been sent to ${email} for organization "${organizationName}". Please review and approve.`,
      relatedEntityType: 'invitation',
      relatedEntityId: invitationId,
    });

    // Send email notifications to admins
    try {
      for (const adminId of adminUserIds) {
        const admin = await User.findById(adminId);
        if (admin && admin.email) {
          await emailService.sendInvitationSentEmail(
            admin.email,
            `${admin.first_name} ${admin.last_name}`,
            email,
            invitedRole || 'user'
          );
        }
      }
    } catch (emailError) {
      console.error('Error sending invitation sent emails:', emailError);
      // Don't fail notifications if email fails
    }

    return notifications;
  },

  /**
   * Notify about invitation approved
   */
  async notifyInvitationApproved(req, invitedUserId, invitationId, organizationName, signupLink) {
    const notification = await createNotification(req, {
      userId: invitedUserId,
      type: 'invitation_approved',
      title: 'Invitation Approved',
      message: `Your invitation to join ${organizationName} has been approved. You can now sign up.`,
      relatedEntityType: 'invitation',
      relatedEntityId: invitationId,
    });

    // Send email notification
    try {
      const user = await User.findById(invitedUserId);
      if (user && user.email) {
        await emailService.sendInvitationApprovedEmail(
          user.email,
          `${user.first_name} ${user.last_name}`,
          organizationName,
          signupLink
        );
      }
    } catch (emailError) {
      console.error('Error sending invitation approved email:', emailError);
      // Don't fail notification if email fails
    }

    return notification;
  },

  /**
   * Notify about invitation rejected
   */
  async notifyInvitationRejected(req, invitedUserId, invitationId, organizationName) {
    const notification = await createNotification(req, {
      userId: invitedUserId,
      type: 'invitation_rejected',
      title: 'Invitation Rejected',
      message: `Your invitation to join ${organizationName} has been rejected. Please contact support.`,
      relatedEntityType: 'invitation',
      relatedEntityId: invitationId,
    });

    // Send email notification
    try {
      const user = await User.findById(invitedUserId);
      if (user && user.email) {
        await emailService.sendInvitationRejectedEmail(
          user.email,
          `${user.first_name} ${user.last_name}`,
          organizationName
        );
      }
    } catch (emailError) {
      console.error('Error sending invitation rejected email:', emailError);
      // Don't fail notification if email fails
    }

    return notification;
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
  async notifyJobRequestCreated(req, adminUserIds, jobRequestId, jobRequestTitle, organizationName, departmentName) {
    const notifications = await createNotificationsForUsers(req, adminUserIds, {
      type: 'job_request_received',
      title: 'New Job Request',
      message: `A new job request "${jobRequestTitle}" has been created for "${organizationName}". Please assign HR.`,
      relatedEntityType: 'job_request',
      relatedEntityId: jobRequestId,
    });

    // Send email notifications
    try {
      for (const adminId of adminUserIds) {
        const admin = await User.findById(adminId);
        if (admin && admin.email) {
          await emailService.sendJobRequestCreatedEmail(
            admin.email,
            `${admin.first_name} ${admin.last_name}`,
            jobRequestTitle,
            organizationName,
            departmentName || '',
            jobRequestId
          );
        }
      }
    } catch (emailError) {
      console.error('Error sending job request created emails:', emailError);
      // Don't fail notifications if email fails
    }

    return notifications;
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
  async notifyCandidateSelected(req, userIds, candidateId, candidateName, jobRequestId, jobRequestTitle, status) {
    const notifications = await createNotificationsForUsers(req, userIds, {
      type: 'candidate_selected',
      title: 'Candidate Status Update',
      message: `Candidate "${candidateName}" for "${jobRequestTitle}" has been marked as "${status}".`,
      relatedEntityType: 'candidate',
      relatedEntityId: candidateId,
    });

    // Send email notifications
    try {
      for (const userId of userIds) {
        const user = await User.findById(userId);
        if (user && user.email) {
          await emailService.sendCandidateSelectedEmail(
            user.email,
            `${user.first_name} ${user.last_name}`,
            candidateName,
            jobRequestTitle,
            status,
            jobRequestId,
            user.user_type
          );
        }
      }
    } catch (emailError) {
      console.error('Error sending candidate selected emails:', emailError);
      // Don't fail notifications if email fails
    }

    return notifications;
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

