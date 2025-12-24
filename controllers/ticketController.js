const Ticket = require('../models/Ticket');
const TicketMessage = require('../models/TicketMessage');
const User = require('../models/User');
const SiteStaff = require('../models/SiteStaff');
const Notification = require('../models/Notification');
const { createNotificationsForUsers } = require('../utils/notificationService');

/**
 * Create a new ticket (staff only)
 */
exports.createTicket = async (req, res) => {
  try {
    const { ticketType, subject, description } = req.body;

    // Verify user is staff (candidate with active site_staff record)
    const user = await User.findById(req.userId);
    if (!user || user.user_type !== 'candidate') {
      return res.status(403).json({
        success: false,
        message: 'Only staff members can create tickets',
      });
    }

    const activeStaff = await SiteStaff.findActiveByUserId(req.userId);
    if (!activeStaff) {
      return res.status(403).json({
        success: false,
        message: 'Only active staff members can create tickets',
      });
    }

    if (!ticketType || !['hr', 'it'].includes(ticketType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ticket type. Must be "hr" or "it"',
      });
    }

    if (!description || description.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Description is required',
      });
    }

    // Create ticket
    const ticket = await Ticket.create({
      createdByUserId: req.userId,
      ticketType,
      subject: subject || null,
      description: description.trim(),
    });

    // Notify all admins
    try {
      const adminUsers = await User.findByType('admin');
      if (adminUsers && adminUsers.length > 0) {
        const adminUserIds = adminUsers.map(u => u.id);
        await createNotificationsForUsers(req, adminUserIds, {
          type: 'ticket_created',
          title: 'New Ticket Created',
          message: `A new ${ticketType.toUpperCase()} ticket has been created${subject ? `: ${subject}` : ''}`,
          relatedEntityType: 'ticket',
          relatedEntityId: ticket.id,
        });
      }
    } catch (notifError) {
      console.error('Error sending ticket creation notification:', notifError);
      // Don't fail the request if notification fails
    }

    // Emit socket event to admins
    try {
      const io = req.app.get('io');
      if (io) {
        io.to('admin-room').emit('new-ticket', {
          ticket: {
            id: ticket.id,
            ticketType: ticket.ticket_type,
            subject: ticket.subject,
            description: ticket.description,
            status: ticket.status,
            createdAt: ticket.created_at,
            createdBy: {
              id: user.id,
              name: user.full_name || `${user.first_name} ${user.last_name}`,
            },
          },
        });
      }
    } catch (socketError) {
      console.error('Error emitting socket event:', socketError);
      // Don't fail the request if socket fails
    }

    res.status(201).json({
      success: true,
      message: 'Ticket created successfully',
      data: { ticket },
    });
  } catch (error) {
    console.error('Create ticket error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Get tickets for staff member (their own tickets)
 */
exports.getMyTickets = async (req, res) => {
  try {
    // Verify user is staff
    const user = await User.findById(req.userId);
    if (!user || user.user_type !== 'candidate') {
      return res.status(403).json({
        success: false,
        message: 'Only staff members can view tickets',
      });
    }

    const { status, page, limit } = req.query;
    const pageNum = page ? parseInt(page, 10) || 1 : null;
    const limitNum = limit ? parseInt(limit, 10) || 10 : 10;

    const result = await Ticket.findByCreator(req.userId, {
      status: status || null,
      page: pageNum,
      limit: limitNum,
    });

    const tickets = pageNum ? result.data : result;
    const pagination = pageNum ? result.pagination : undefined;

    // Format tickets
    const formattedTickets = tickets.map(t => ({
      id: t.id,
      ticketType: t.ticket_type,
      subject: t.subject,
      description: t.description,
      status: t.status,
      assignedToUserId: t.assigned_to_user_id,
      assignedToName: t.assignee_full_name || (t.assignee_first_name && t.assignee_last_name ? `${t.assignee_first_name} ${t.assignee_last_name}` : null),
      assignedAt: t.assigned_at,
      resolvedAt: t.resolved_at,
      createdAt: t.created_at,
      updatedAt: t.updated_at,
    }));

    // Get unread notification counts for all tickets
    let unreadCounts = {};
    try {
      const ticketIds = formattedTickets.map(t => t.id);
      if (ticketIds.length > 0) {
        unreadCounts = await Notification.getUnreadCountsByTickets(req.userId, ticketIds);
      }
    } catch (error) {
      console.error('Error getting unread counts:', error);
    }

    // Add unread counts to tickets
    const ticketsWithCounts = formattedTickets.map(t => ({
      ...t,
      unreadCount: unreadCounts[t.id] || 0,
    }));

    res.json({
      success: true,
      data: {
        tickets: ticketsWithCounts,
        ...(pagination ? { pagination } : {}),
      },
    });
  } catch (error) {
    console.error('Get my tickets error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Get assigned tickets (for HR users)
 */
exports.getAssignedTickets = async (req, res) => {
  try {
    // Verify user is HR
    const user = await User.findById(req.userId);
    if (!user || user.user_type !== 'hr') {
      return res.status(403).json({
        success: false,
        message: 'Only HR users can view assigned tickets',
      });
    }

    const { status, page, limit } = req.query;
    const pageNum = page ? parseInt(page, 10) || 1 : null;
    const limitNum = limit ? parseInt(limit, 10) || 10 : 10;

    const result = await Ticket.findByAssigned(req.userId, {
      status: status || null,
      page: pageNum,
      limit: limitNum,
    });

    const tickets = pageNum ? result.data : result;
    const pagination = pageNum ? result.pagination : undefined;

    // Format tickets
    const formattedTickets = tickets.map(t => ({
      id: t.id,
      ticketType: t.ticket_type,
      subject: t.subject,
      description: t.description,
      status: t.status,
      createdByUserId: t.created_by_user_id,
      createdByName: t.creator_full_name || (t.creator_first_name && t.creator_last_name ? `${t.creator_first_name} ${t.creator_last_name}` : null),
      assignedAt: t.assigned_at,
      resolvedAt: t.resolved_at,
      createdAt: t.created_at,
      updatedAt: t.updated_at,
    }));

    // Get unread notification counts for all tickets
    let unreadCounts = {};
    try {
      const ticketIds = formattedTickets.map(t => t.id);
      if (ticketIds.length > 0) {
        unreadCounts = await Notification.getUnreadCountsByTickets(req.userId, ticketIds);
      }
    } catch (error) {
      console.error('Error getting unread counts:', error);
    }

    // Add unread counts to tickets
    const ticketsWithCounts = formattedTickets.map(t => ({
      ...t,
      unreadCount: unreadCounts[t.id] || 0,
    }));

    res.json({
      success: true,
      data: {
        tickets: ticketsWithCounts,
        ...(pagination ? { pagination } : {}),
      },
    });
  } catch (error) {
    console.error('Get assigned tickets error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Get all tickets (admin only)
 */
exports.getAllTickets = async (req, res) => {
  try {
    // Verify user is admin
    const user = await User.findById(req.userId);
    if (!user || user.user_type !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can view all tickets',
      });
    }

    const { status, ticketType, page, limit } = req.query;
    const pageNum = page ? parseInt(page, 10) || 1 : null;
    const limitNum = limit ? parseInt(limit, 10) || 10 : 10;

    const result = await Ticket.findAll({
      status: status || null,
      ticketType: ticketType || null,
      page: pageNum,
      limit: limitNum,
    });

    const tickets = pageNum ? result.data : result;
    const pagination = pageNum ? result.pagination : undefined;

    // Format tickets
    const formattedTickets = tickets.map(t => ({
      id: t.id,
      ticketType: t.ticket_type,
      subject: t.subject,
      description: t.description,
      status: t.status,
      createdByUserId: t.created_by_user_id,
      createdByName: t.creator_full_name || (t.creator_first_name && t.creator_last_name ? `${t.creator_first_name} ${t.creator_last_name}` : null),
      assignedToUserId: t.assigned_to_user_id,
      assignedToName: t.assignee_full_name || (t.assignee_first_name && t.assignee_last_name ? `${t.assignee_first_name} ${t.assignee_last_name}` : null),
      assignedAt: t.assigned_at,
      resolvedAt: t.resolved_at,
      createdAt: t.created_at,
      updatedAt: t.updated_at,
    }));

    // Get unread notification counts for all tickets
    let unreadCounts = {};
    try {
      const ticketIds = formattedTickets.map(t => t.id);
      if (ticketIds.length > 0) {
        unreadCounts = await Notification.getUnreadCountsByTickets(req.userId, ticketIds);
      }
    } catch (error) {
      console.error('Error getting unread counts:', error);
    }

    // Add unread counts to tickets
    const ticketsWithCounts = formattedTickets.map(t => ({
      ...t,
      unreadCount: unreadCounts[t.id] || 0,
    }));

    res.json({
      success: true,
      data: {
        tickets: ticketsWithCounts,
        ...(pagination ? { pagination } : {}),
      },
    });
  } catch (error) {
    console.error('Get all tickets error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Get ticket by ID with messages
 */
exports.getTicketById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(req.userId);

    const ticket = await Ticket.findById(id);
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found',
      });
    }

    // Check access: staff can view their own tickets, admin can view all, HR can view assigned tickets
    if (user.user_type === 'candidate') {
      if (ticket.created_by_user_id !== parseInt(req.userId)) {
        return res.status(403).json({
          success: false,
          message: 'You can only view your own tickets',
        });
      }
    } else if (user.user_type === 'hr') {
      if (ticket.assigned_to_user_id !== parseInt(req.userId)) {
        return res.status(403).json({
          success: false,
          message: 'You can only view tickets assigned to you',
        });
      }
    } else if (user.user_type !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to view tickets',
      });
    }

    // Get messages
    const messages = await TicketMessage.findByTicket(id);

    // Format ticket
    const formattedTicket = {
      id: ticket.id,
      ticketType: ticket.ticket_type,
      subject: ticket.subject,
      description: ticket.description,
      status: ticket.status,
      createdByUserId: ticket.created_by_user_id,
      createdByName: ticket.creator_full_name || (ticket.creator_first_name && ticket.creator_last_name ? `${ticket.creator_first_name} ${ticket.creator_last_name}` : null),
      assignedToUserId: ticket.assigned_to_user_id,
      assignedToName: ticket.assignee_full_name || (ticket.assignee_first_name && ticket.assignee_last_name ? `${ticket.assignee_first_name} ${ticket.assignee_last_name}` : null),
      assignedAt: ticket.assigned_at,
      resolvedAt: ticket.resolved_at,
      createdAt: ticket.created_at,
      updatedAt: ticket.updated_at,
    };

    // Format messages
    const formattedMessages = messages.map(m => ({
      id: m.id,
      ticketId: m.ticket_id,
      sentByUserId: m.user_id,
      sentByName: m.user_full_name || (m.user_first_name && m.user_last_name ? `${m.user_first_name} ${m.user_last_name}` : null),
      sentByUserType: m.user_type,
      message: m.message,
      createdAt: m.created_at,
    }));

    // Get unread notification count for this ticket
    let unreadCount = 0;
    try {
      const unreadCounts = await Notification.getUnreadCountsByTickets(req.userId, [ticket.id]);
      unreadCount = unreadCounts[ticket.id] || 0;
    } catch (error) {
      console.error('Error getting unread count:', error);
    }

    res.json({
      success: true,
      data: {
        ticket: formattedTicket,
        messages: formattedMessages,
        unreadCount,
      },
    });
  } catch (error) {
    console.error('Get ticket by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Add message to ticket
 */
exports.addMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;
    const user = await User.findById(req.userId);

    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Message is required',
      });
    }

    const ticket = await Ticket.findById(id);
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found',
      });
    }

    // Check access: staff can reply to their own tickets, admin can reply to any, HR can reply to assigned tickets
    if (user.user_type === 'candidate') {
      if (ticket.created_by_user_id !== parseInt(req.userId)) {
        return res.status(403).json({
          success: false,
          message: 'You can only reply to your own tickets',
        });
      }
    } else if (user.user_type === 'hr') {
      if (ticket.assigned_to_user_id !== parseInt(req.userId)) {
        return res.status(403).json({
          success: false,
          message: 'You can only reply to tickets assigned to you',
        });
      }
    } else if (user.user_type !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to reply to tickets',
      });
    }

    // Create message
    const ticketMessage = await TicketMessage.create({
      ticketId: id,
      sentByUserId: req.userId,
      message: message.trim(),
    });

    // Update ticket status if needed
    if (ticket.status === 'open' && user.user_type !== 'candidate') {
      await Ticket.update(id, { status: 'in_progress' });
    }

    // Notify relevant users
    try {
      const notifyUserIds = [];
      
      if (user.user_type === 'candidate') {
        // Staff replied - notify the handler (assigned HR if exists, otherwise admin)
        if (ticket.assigned_to_user_id) {
          // Ticket is assigned - notify assigned HR only
          notifyUserIds.push(ticket.assigned_to_user_id);
        } else {
          // Ticket not assigned - notify admin
          const adminUsers = await User.findByType('admin');
          if (adminUsers) {
            notifyUserIds.push(...adminUsers.map(u => u.id));
          }
        }
      } else if (user.user_type === 'hr') {
        // HR replied - notify ticket creator (staff) only
        notifyUserIds.push(ticket.created_by_user_id);
      } else if (user.user_type === 'admin') {
        // Admin replied - notify ticket creator (staff) and assigned HR if exists
        notifyUserIds.push(ticket.created_by_user_id);
        if (ticket.assigned_to_user_id) {
          notifyUserIds.push(ticket.assigned_to_user_id);
        }
      }

      // Remove current user from notification list
      const uniqueUserIds = [...new Set(notifyUserIds.filter(uid => uid !== parseInt(req.userId)))];

      if (uniqueUserIds.length > 0) {
        await createNotificationsForUsers(req, uniqueUserIds, {
          type: 'ticket_message',
          title: 'New Ticket Reply',
          message: `A new reply has been added to ticket${ticket.subject ? `: ${ticket.subject}` : ''}`,
          relatedEntityType: 'ticket',
          relatedEntityId: ticket.id,
        });
      }
    } catch (notifError) {
      console.error('Error sending ticket message notification:', notifError);
      // Don't fail the request if notification fails
    }

    // Emit socket event
    try {
      const io = req.app.get('io');
      if (io) {
        // Notify ticket creator
        io.to(`user-${ticket.created_by_user_id}`).emit('ticket-message', {
          ticketId: ticket.id,
          message: {
            id: ticketMessage.id,
            message: ticketMessage.message,
            sentBy: {
              id: user.id,
              name: user.full_name || `${user.first_name} ${user.last_name}`,
              userType: user.user_type,
            },
            createdAt: ticketMessage.created_at,
          },
        });

        // Notify assigned user if exists
        if (ticket.assigned_to_user_id) {
          io.to(`user-${ticket.assigned_to_user_id}`).emit('ticket-message', {
            ticketId: ticket.id,
            message: {
              id: ticketMessage.id,
              message: ticketMessage.message,
              sentBy: {
                id: user.id,
                name: user.full_name || `${user.first_name} ${user.last_name}`,
                userType: user.user_type,
              },
              createdAt: ticketMessage.created_at,
            },
          });
        }

        // Notify admins
        io.to('admin-room').emit('ticket-message', {
          ticketId: ticket.id,
          message: {
            id: ticketMessage.id,
            message: ticketMessage.message,
            sentBy: {
              id: user.id,
              name: user.full_name || `${user.first_name} ${user.last_name}`,
              userType: user.user_type,
            },
            createdAt: ticketMessage.created_at,
          },
        });
      }
    } catch (socketError) {
      console.error('Error emitting socket event:', socketError);
      // Don't fail the request if socket fails
    }

    res.json({
      success: true,
      message: 'Message added successfully',
      data: { message: ticketMessage },
    });
  } catch (error) {
    console.error('Add ticket message error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Assign ticket to HR user (admin only)
 */
exports.assignTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const { assignedToUserId } = req.body;

    // Verify user is admin
    const user = await User.findById(req.userId);
    if (!user || user.user_type !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can assign tickets',
      });
    }

    const ticket = await Ticket.findById(id);
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found',
      });
    }

    // Verify assigned user is HR
    if (assignedToUserId) {
      const assignee = await User.findById(assignedToUserId);
      if (!assignee || assignee.user_type !== 'hr') {
        return res.status(400).json({
          success: false,
          message: 'Can only assign tickets to HR users',
        });
      }
    }

    // Update ticket
    const updated = await Ticket.update(id, {
      assignedToUserId: assignedToUserId || null,
      status: assignedToUserId ? 'assigned' : 'open',
    });

    // Notify assigned user
    if (assignedToUserId) {
      try {
        await createNotificationsForUsers(req, [assignedToUserId], {
          type: 'ticket_assigned',
          title: 'Ticket Assigned to You',
          message: `A ${ticket.ticket_type.toUpperCase()} ticket has been assigned to you${ticket.subject ? `: ${ticket.subject}` : ''}`,
          relatedEntityType: 'ticket',
          relatedEntityId: ticket.id,
        });
      } catch (notifError) {
        console.error('Error sending assignment notification:', notifError);
      }

      // Emit socket event
      try {
        const io = req.app.get('io');
        if (io) {
          io.to(`user-${assignedToUserId}`).emit('ticket-assigned', {
            ticket: {
              id: updated.id,
              ticketType: updated.ticket_type,
              subject: updated.subject,
              status: updated.status,
            },
          });
        }
      } catch (socketError) {
        console.error('Error emitting socket event:', socketError);
      }
    }

    res.json({
      success: true,
      message: assignedToUserId ? 'Ticket assigned successfully' : 'Ticket unassigned successfully',
      data: { ticket: updated },
    });
  } catch (error) {
    console.error('Assign ticket error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Update ticket status (admin and assigned HR)
 */
exports.updateTicketStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const user = await User.findById(req.userId);
    const ticket = await Ticket.findById(id);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found',
      });
    }

    // Check access: admin can update any ticket, HR can update assigned tickets
    if (user.user_type === 'hr') {
      if (ticket.assigned_to_user_id !== parseInt(req.userId)) {
        return res.status(403).json({
          success: false,
          message: 'You can only update tickets assigned to you',
        });
      }
    } else if (user.user_type !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to update ticket status',
      });
    }

    if (!status || !['open', 'assigned', 'in_progress', 'resolved', 'closed'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status',
      });
    }

    const updated = await Ticket.update(id, { status });

    // Emit socket event for real-time status update
    try {
      const io = req.app.get('io');
      if (io) {
        // Notify ticket creator (staff)
        io.to(`user-${ticket.created_by_user_id}`).emit('ticket-status-updated', {
          ticketId: ticket.id,
          status: status,
          ticket: updated,
        });

        // Notify assigned HR user if ticket is assigned
        if (ticket.assigned_to_user_id) {
          io.to(`user-${ticket.assigned_to_user_id}`).emit('ticket-status-updated', {
            ticketId: ticket.id,
            status: status,
            ticket: updated,
          });
        }

        // Notify admin room
        io.to('admin-room').emit('ticket-status-updated', {
          ticketId: ticket.id,
          status: status,
          ticket: updated,
        });
      }
    } catch (socketError) {
      console.error('Error emitting ticket status update:', socketError);
      // Don't fail the request if socket emission fails
    }

    res.json({
      success: true,
      message: 'Ticket status updated successfully',
      data: { ticket: updated },
    });
  } catch (error) {
    console.error('Update ticket status error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

