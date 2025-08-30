const express = require('express');
const router = express.Router();
const { auth, canManageClients, canViewReports } = require('../middleware/auth-file');
const databaseManager = require('../utils/databaseManager');
const membershipNotificationService = require('../utils/membershipNotificationService');

// Get all memberships with filtering and pagination
router.get('/', auth, canViewReports, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      status, 
      membershipType, 
      clientName, 
      expiring,
      sortBy = 'createdAt',
      sortOrder = 'desc' 
    } = req.query;

    const filters = {};
    
    if (status) filters.status = status;
    if (membershipType) filters.membershipType = membershipType;
    if (clientName) {
      filters.clientName = new RegExp(clientName, 'i');
    }
    
    // Filter for expiring memberships (within 3 days)
    if (expiring === 'true') {
      const threeDaysFromNow = new Date();
      threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
      filters.endDate = { $lte: threeDaysFromNow };
      filters.status = 'active';
    }

    const memberships = await databaseManager.getMemberships(filters, {
      page: parseInt(page),
      limit: parseInt(limit),
      sortBy,
      sortOrder
    });

    // Add virtual fields
    const membershipsWithVirtuals = memberships.data.map(membership => ({
      ...membership,
      daysRemaining: calculateDaysRemaining(membership),
      isExpiring: calculateIsExpiring(membership)
    }));

    res.json({
      ...memberships,
      data: membershipsWithVirtuals
    });
  } catch (error) {
    console.error('Error fetching memberships:', error);
    res.status(500).json({ error: 'Failed to fetch memberships' });
  }
});

// Get membership by ID
router.get('/:id', auth, canViewReports, async (req, res) => {
  try {
    const membership = await databaseManager.getMembershipById(req.params.id);
    
    if (!membership) {
      return res.status(404).json({ error: 'Membership not found' });
    }

    // Add virtual fields
    const membershipWithVirtuals = {
      ...membership,
      daysRemaining: calculateDaysRemaining(membership),
      isExpiring: calculateIsExpiring(membership)
    };

    res.json(membershipWithVirtuals);
  } catch (error) {
    console.error('Error fetching membership:', error);
    res.status(500).json({ error: 'Failed to fetch membership' });
  }
});

// Create new membership
router.post('/', auth, canManageClients, async (req, res) => {
  try {
    const {
      clientName,
      email,
      phone,
      membershipType,
      plan,
      price,
      startDate,
      paymentMethod,
      notes,
      autoRenew = false,
      services = {}
    } = req.body;

    // Validation
    if (!clientName || !membershipType || !plan || !price || !paymentMethod) {
      return res.status(400).json({
        error: 'Client name, membership type, plan, price, and payment method are required'
      });
    }

    if (!['daily', 'weekly', 'monthly'].includes(membershipType)) {
      return res.status(400).json({
        error: 'Membership type must be daily, weekly, or monthly'
      });
    }

    if (!['efectivo', 'tarjeta', 'transferencia'].includes(paymentMethod)) {
      return res.status(400).json({
        error: 'Payment method must be efectivo, tarjeta, or transferencia'
      });
    }

    if (price < 0) {
      return res.status(400).json({
        error: 'Price cannot be negative'
      });
    }

    // Calculate end date based on membership type
    const start = startDate ? new Date(startDate) : new Date();
    const end = new Date(start);
    
    switch (membershipType) {
      case 'daily':
        end.setDate(start.getDate() + 1);
        break;
      case 'weekly':
        end.setDate(start.getDate() + 7);
        break;
      case 'monthly':
        end.setMonth(start.getMonth() + 1);
        break;
    }

    const membershipData = {
      id: generateId(),
      clientName: clientName.trim(),
      email: email?.trim().toLowerCase(),
      phone: phone?.trim(),
      membershipType,
      plan: plan.trim(),
      price: parseFloat(price),
      startDate: start,
      endDate: end,
      status: 'active',
      autoRenew,
      paymentMethod,
      notes: notes?.trim(),
      createdBy: req.user.id,
      lastPayment: {
        date: new Date(),
        amount: parseFloat(price),
        method: paymentMethod
      },
      paymentHistory: [{
        date: new Date(),
        amount: parseFloat(price),
        method: paymentMethod,
        notes: 'Pago inicial de membresía'
      }],
      services: {
        coworking: services.coworking || false,
        cafeteria: services.cafeteria || false,
        printing: services.printing || false,
        meeting_room: services.meeting_room || false
      },
      usage: {
        totalHours: 0,
        currentMonthHours: 0,
        lastUsed: null
      },
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const membership = await databaseManager.createMembership(membershipData);
    
    // Add virtual fields
    const membershipWithVirtuals = {
      ...membership,
      daysRemaining: calculateDaysRemaining(membership),
      isExpiring: calculateIsExpiring(membership)
    };

    res.status(201).json(membershipWithVirtuals);
  } catch (error) {
    console.error('Error creating membership:', error);
    res.status(500).json({ error: 'Failed to create membership' });
  }
});

// Update membership
router.put('/:id', auth, canManageClients, async (req, res) => {
  try {
    const {
      clientName,
      email,
      phone,
      membershipType,
      plan,
      price,
      status,
      autoRenew,
      paymentMethod,
      notes,
      services
    } = req.body;

    const existingMembership = await databaseManager.getMembershipById(req.params.id);
    if (!existingMembership) {
      return res.status(404).json({ error: 'Membership not found' });
    }

    // Validation
    if (membershipType && !['daily', 'weekly', 'monthly'].includes(membershipType)) {
      return res.status(400).json({
        error: 'Membership type must be daily, weekly, or monthly'
      });
    }

    if (status && !['active', 'expired', 'cancelled', 'pending'].includes(status)) {
      return res.status(400).json({
        error: 'Status must be active, expired, cancelled, or pending'
      });
    }

    if (paymentMethod && !['efectivo', 'tarjeta', 'transferencia'].includes(paymentMethod)) {
      return res.status(400).json({
        error: 'Payment method must be efectivo, tarjeta, or transferencia'
      });
    }

    if (price !== undefined && price < 0) {
      return res.status(400).json({
        error: 'Price cannot be negative'
      });
    }

    // Prepare update data
    const updateData = {
      updatedAt: new Date()
    };

    if (clientName) updateData.clientName = clientName.trim();
    if (email !== undefined) updateData.email = email?.trim().toLowerCase();
    if (phone !== undefined) updateData.phone = phone?.trim();
    if (membershipType) updateData.membershipType = membershipType;
    if (plan) updateData.plan = plan.trim();
    if (price !== undefined) updateData.price = parseFloat(price);
    if (status) updateData.status = status;
    if (autoRenew !== undefined) updateData.autoRenew = autoRenew;
    if (paymentMethod) updateData.paymentMethod = paymentMethod;
    if (notes !== undefined) updateData.notes = notes?.trim();
    if (services) updateData.services = { ...existingMembership.services, ...services };

    // If membership type changed, recalculate end date
    if (membershipType && membershipType !== existingMembership.membershipType) {
      const start = new Date(existingMembership.startDate);
      const end = new Date(start);
      
      switch (membershipType) {
        case 'daily':
          end.setDate(start.getDate() + 1);
          break;
        case 'weekly':
          end.setDate(start.getDate() + 7);
          break;
        case 'monthly':
          end.setMonth(start.getMonth() + 1);
          break;
      }
      
      updateData.endDate = end;
    }

    const membership = await databaseManager.updateMembership(req.params.id, updateData);
    
    // Add virtual fields
    const membershipWithVirtuals = {
      ...membership,
      daysRemaining: calculateDaysRemaining(membership),
      isExpiring: calculateIsExpiring(membership)
    };

    res.json(membershipWithVirtuals);
  } catch (error) {
    console.error('Error updating membership:', error);
    res.status(500).json({ error: 'Failed to update membership' });
  }
});

// Renew membership
router.post('/:id/renew', auth, canManageClients, async (req, res) => {
  try {
    const { paymentMethod, amount, notes } = req.body;

    if (!paymentMethod || amount === undefined) {
      return res.status(400).json({
        error: 'Payment method and amount are required'
      });
    }

    if (!['efectivo', 'tarjeta', 'transferencia'].includes(paymentMethod)) {
      return res.status(400).json({
        error: 'Payment method must be efectivo, tarjeta, or transferencia'
      });
    }

    if (amount < 0) {
      return res.status(400).json({
        error: 'Amount cannot be negative'
      });
    }

    const existingMembership = await databaseManager.getMembershipById(req.params.id);
    if (!existingMembership) {
      return res.status(404).json({ error: 'Membership not found' });
    }

    // Calculate new dates
    const duration = existingMembership.membershipType === 'daily' ? 1 : 
                    existingMembership.membershipType === 'weekly' ? 7 : 30;
    
    const newStartDate = new Date();
    const newEndDate = new Date();
    newEndDate.setDate(newEndDate.getDate() + duration);

    const renewalData = {
      startDate: newStartDate,
      endDate: newEndDate,
      status: 'active',
      lastPayment: {
        date: new Date(),
        amount: parseFloat(amount),
        method: paymentMethod
      },
      paymentHistory: [
        ...existingMembership.paymentHistory,
        {
          date: new Date(),
          amount: parseFloat(amount),
          method: paymentMethod,
          notes: notes || 'Renovación de membresía'
        }
      ],
      updatedAt: new Date()
    };

    const membership = await databaseManager.updateMembership(req.params.id, renewalData);
    
    // Add virtual fields
    const membershipWithVirtuals = {
      ...membership,
      daysRemaining: calculateDaysRemaining(membership),
      isExpiring: calculateIsExpiring(membership)
    };

    res.json(membershipWithVirtuals);
  } catch (error) {
    console.error('Error renewing membership:', error);
    res.status(500).json({ error: 'Failed to renew membership' });
  }
});

// Cancel membership
router.post('/:id/cancel', auth, canManageClients, async (req, res) => {
  try {
    const { reason } = req.body;

    const existingMembership = await databaseManager.getMembershipById(req.params.id);
    if (!existingMembership) {
      return res.status(404).json({ error: 'Membership not found' });
    }

    const cancelData = {
      status: 'cancelled',
      notes: existingMembership.notes 
        ? `${existingMembership.notes}\nCancelada: ${reason || 'Sin razón especificada'}`
        : `Cancelada: ${reason || 'Sin razón especificada'}`,
      updatedAt: new Date()
    };

    const membership = await databaseManager.updateMembership(req.params.id, cancelData);
    
    // Add virtual fields
    const membershipWithVirtuals = {
      ...membership,
      daysRemaining: calculateDaysRemaining(membership),
      isExpiring: calculateIsExpiring(membership)
    };

    res.json(membershipWithVirtuals);
  } catch (error) {
    console.error('Error cancelling membership:', error);
    res.status(500).json({ error: 'Failed to cancel membership' });
  }
});

// Delete membership (soft delete)
router.delete('/:id', auth, canManageClients, async (req, res) => {
  try {
    const membership = await databaseManager.getMembershipById(req.params.id);
    if (!membership) {
      return res.status(404).json({ error: 'Membership not found' });
    }

    await databaseManager.updateMembership(req.params.id, { 
      isDeleted: true,
      updatedAt: new Date()
    });

    res.json({ message: 'Membership deleted successfully' });
  } catch (error) {
    console.error('Error deleting membership:', error);
    res.status(500).json({ error: 'Failed to delete membership' });
  }
});

// Get membership statistics
router.get('/stats/overview', auth, canViewReports, async (req, res) => {
  try {
    const stats = await databaseManager.getMembershipStats();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching membership statistics:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Get expiring memberships
router.get('/alerts/expiring', auth, canViewReports, async (req, res) => {
  try {
    const { days = 3 } = req.query;
    
    const alertDate = new Date();
    alertDate.setDate(alertDate.getDate() + parseInt(days));
    
    const filters = {
      endDate: { $lte: alertDate },
      status: 'active'
    };

    const expiringMemberships = await databaseManager.getMemberships(filters);
    
    // Add virtual fields
    const membershipsWithVirtuals = expiringMemberships.data.map(membership => ({
      ...membership,
      daysRemaining: calculateDaysRemaining(membership),
      isExpiring: calculateIsExpiring(membership)
    }));

    res.json({
      ...expiringMemberships,
      data: membershipsWithVirtuals
    });
  } catch (error) {
    console.error('Error fetching expiring memberships:', error);
    res.status(500).json({ error: 'Failed to fetch expiring memberships' });
  }
});

// NOTIFICATION ENDPOINTS

// Get notifications
router.get('/notifications', auth, canViewReports, async (req, res) => {
  try {
    const { unreadOnly, type, priority, limit } = req.query;
    
    const options = {};
    if (unreadOnly === 'true') options.unreadOnly = true;
    if (type) options.type = type;
    if (priority) options.priority = priority;
    if (limit) options.limit = parseInt(limit);
    
    const notifications = membershipNotificationService.getNotifications(options);
    const unreadCount = membershipNotificationService.getUnreadCount();
    
    res.json({
      notifications,
      unreadCount,
      total: notifications.length
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Mark notification as read
router.patch('/notifications/:id/read', auth, canViewReports, async (req, res) => {
  try {
    const success = membershipNotificationService.markAsRead(req.params.id);
    
    if (!success) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    
    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// Mark all notifications as read
router.patch('/notifications/read-all', auth, canViewReports, async (req, res) => {
  try {
    const count = membershipNotificationService.markAllAsRead();
    res.json({ message: `${count} notifications marked as read` });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ error: 'Failed to mark notifications as read' });
  }
});

// Delete notification
router.delete('/notifications/:id', auth, canManageClients, async (req, res) => {
  try {
    const success = membershipNotificationService.deleteNotification(req.params.id);
    
    if (!success) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    
    res.json({ message: 'Notification deleted' });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

// Trigger manual expiration check
router.post('/notifications/check-expiring', auth, canManageClients, async (req, res) => {
  try {
    const count = await membershipNotificationService.triggerExpirationCheck();
    res.json({ 
      message: 'Expiration check completed',
      notificationsCreated: count 
    });
  } catch (error) {
    console.error('Error triggering expiration check:', error);
    res.status(500).json({ error: 'Failed to check expiring memberships' });
  }
});

// Get notification stats
router.get('/notifications/stats', auth, canViewReports, async (req, res) => {
  try {
    const unreadCount = membershipNotificationService.getUnreadCount();
    const allNotifications = membershipNotificationService.getNotifications();
    
    const stats = {
      total: allNotifications.length,
      unread: unreadCount,
      read: allNotifications.length - unreadCount,
      byType: allNotifications.reduce((acc, n) => {
        acc[n.type] = (acc[n.type] || 0) + 1;
        return acc;
      }, {}),
      byPriority: allNotifications.reduce((acc, n) => {
        acc[n.priority] = (acc[n.priority] || 0) + 1;
        return acc;
      }, {})
    };
    
    res.json(stats);
  } catch (error) {
    console.error('Error fetching notification stats:', error);
    res.status(500).json({ error: 'Failed to fetch notification stats' });
  }
});

// Helper functions
function calculateDaysRemaining(membership) {
  if (membership.status === 'expired' || membership.status === 'cancelled') {
    return 0;
  }
  const now = new Date();
  const end = new Date(membership.endDate);
  const diffTime = end - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
}

function calculateIsExpiring(membership) {
  const daysRemaining = calculateDaysRemaining(membership);
  return daysRemaining <= 3 && daysRemaining > 0;
}

function generateId() {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

module.exports = router;