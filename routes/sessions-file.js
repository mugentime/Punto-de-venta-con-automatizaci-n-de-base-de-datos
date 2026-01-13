const express = require('express');
const databaseManager = require('../utils/databaseManager');
const { auth } = require('../middleware/auth-file');
const CoworkingSession = require('../models/CoworkingSession');

const router = express.Router();

// Permission middleware
const canManageCoworking = (req, res, next) => {
  if (req.user.permissions?.canRegisterClients || req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ error: 'Insufficient permissions for coworking management' });
  }
};

// Get all active coworking sessions
router.get('/active', auth, async (req, res) => {
  try {
    const sessions = await databaseManager.getActiveCoworkingSessions();
    
    // Calculate real-time totals for each session
    const enrichedSessions = sessions.map(sessionData => {
      const session = new CoworkingSession(sessionData);
      session.calculateTotals(); // Update with current time
      return session.toJSON();
    });

    res.json({
      sessions: enrichedSessions,
      count: enrichedSessions.length,
      totalCurrentCharge: enrichedSessions.reduce((sum, s) => sum + s.total, 0)
    });

  } catch (error) {
    console.error('Get active sessions error:', error);
    res.status(500).json({
      error: 'Failed to fetch active sessions'
    });
  }
});

// Get all sessions (including closed)
router.get('/', auth, async (req, res) => {
  try {
    const { status, client, limit = 50 } = req.query;
    
    let sessions = await databaseManager.getCoworkingSessions();
    
    // Filter by status if provided
    if (status) {
      sessions = sessions.filter(s => s.status === status);
    }
    
    // Filter by client if provided
    if (client) {
      sessions = sessions.filter(s => 
        s.client.toLowerCase().includes(client.toLowerCase())
      );
    }
    
    // Sort by creation date (newest first)
    sessions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    // Limit results
    sessions = sessions.slice(0, parseInt(limit));
    
    res.json({
      sessions,
      count: sessions.length
    });

  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({
      error: 'Failed to fetch sessions'
    });
  }
});

// Get specific session by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const sessionData = await databaseManager.getCoworkingSessionById(req.params.id);
    
    if (!sessionData) {
      return res.status(404).json({
        error: 'Session not found'
      });
    }
    
    // Calculate real-time totals if session is active
    if (sessionData.status === 'active') {
      const session = new CoworkingSession(sessionData);
      session.calculateTotals();
      return res.json(session.toJSON());
    }
    
    res.json(sessionData);

  } catch (error) {
    console.error('Get session error:', error);
    res.status(500).json({
      error: 'Failed to fetch session'
    });
  }
});

// Create new coworking session
router.post('/', auth, canManageCoworking, async (req, res) => {
  try {
    const { client, hourlyRate = 72, notes = '', startTime } = req.body;

    // Validation
    if (!client || client.trim().length === 0) {
      return res.status(400).json({
        error: 'Client name is required'
      });
    }

    if (hourlyRate <= 0) {
      return res.status(400).json({
        error: 'Hourly rate must be greater than 0'
      });
    }

    // Create session using model
    const sessionData = {
      client: client.trim(),
      hourlyRate: parseFloat(hourlyRate),
      notes: notes.trim(),
      createdBy: req.user.userId
    };

    // If custom startTime is provided, use it
    if (startTime) {
      sessionData.startTime = new Date(startTime).toISOString();
    }

    const session = new CoworkingSession(sessionData);

    // Validate session
    const validation = session.validate();
    if (!validation.isValid) {
      return res.status(400).json({
        error: 'Invalid session data',
        details: validation.errors
      });
    }

    // Save to database
    const createdSession = await databaseManager.createCoworkingSession(session.toJSON());

    res.status(201).json({
      message: 'Coworking session started successfully',
      session: createdSession
    });

  } catch (error) {
    console.error('Create session error:', error);
    res.status(500).json({
      error: 'Failed to create session'
    });
  }
});

// Add product to existing session
router.post('/:id/products', auth, canManageCoworking, async (req, res) => {
  try {
    const { productId, quantity = 1 } = req.body;
    const sessionId = req.params.id;

    // Validation
    if (!productId) {
      return res.status(400).json({
        error: 'Product ID is required'
      });
    }

    if (quantity <= 0) {
      return res.status(400).json({
        error: 'Quantity must be greater than 0'
      });
    }

    // Check if session exists and is active
    const session = await databaseManager.getCoworkingSessionById(sessionId);
    if (!session) {
      return res.status(404).json({
        error: 'Session not found'
      });
    }

    if (session.status !== 'active') {
      return res.status(400).json({
        error: 'Cannot add products to closed session'
      });
    }

    // Add product to session
    const updatedSession = await databaseManager.addProductToCoworkingSession(sessionId, {
      productId,
      quantity: parseInt(quantity)
    });

    res.json({
      message: 'Product added to session successfully',
      session: updatedSession
    });

  } catch (error) {
    console.error('Add product to session error:', error);
    
    if (error.message.includes('not found') || error.message.includes('inactive')) {
      return res.status(404).json({ error: error.message });
    }
    
    if (error.message.includes('stock')) {
      return res.status(400).json({ error: error.message });
    }
    
    res.status(500).json({
      error: 'Failed to add product to session'
    });
  }
});

// Update session (notes, hourly rate, etc.)
router.put('/:id', auth, canManageCoworking, async (req, res) => {
  try {
    const { client, hourlyRate, notes } = req.body;
    const sessionId = req.params.id;

    // Check if session exists
    const session = await databaseManager.getCoworkingSessionById(sessionId);
    if (!session) {
      return res.status(404).json({
        error: 'Session not found'
      });
    }

    if (session.status !== 'active') {
      return res.status(400).json({
        error: 'Cannot update closed session'
      });
    }

    // Prepare update data
    const updateData = {};
    if (client !== undefined) updateData.client = client.trim();
    if (hourlyRate !== undefined) updateData.hourlyRate = parseFloat(hourlyRate);
    if (notes !== undefined) updateData.notes = notes.trim();

    // Validate updates
    if (updateData.client && updateData.client.length === 0) {
      return res.status(400).json({
        error: 'Client name cannot be empty'
      });
    }

    if (updateData.hourlyRate && updateData.hourlyRate <= 0) {
      return res.status(400).json({
        error: 'Hourly rate must be greater than 0'
      });
    }

    // Update session
    const updatedSession = await databaseManager.updateCoworkingSession(sessionId, updateData);

    res.json({
      message: 'Session updated successfully',
      session: updatedSession
    });

  } catch (error) {
    console.error('Update session error:', error);
    res.status(500).json({
      error: 'Failed to update session'
    });
  }
});

// Close session and create record
router.post('/:id/checkout', auth, canManageCoworking, async (req, res) => {
  try {
    const { payment, notes } = req.body;
    const sessionId = req.params.id;

    // Validation
    if (!payment || !['efectivo', 'tarjeta', 'transferencia'].includes(payment.toLowerCase())) {
      return res.status(400).json({
        error: 'Valid payment method is required (efectivo, tarjeta, transferencia)'
      });
    }

    // Check if session exists and is active
    const session = await databaseManager.getCoworkingSessionById(sessionId);
    if (!session) {
      return res.status(404).json({
        error: 'Session not found'
      });
    }

    if (session.status !== 'active') {
      return res.status(400).json({
        error: 'Session is already closed'
      });
    }

    // Update notes if provided
    if (notes) {
      await databaseManager.updateCoworkingSession(sessionId, { notes: notes.trim() });
    }

    // Close session and create record
    const result = await databaseManager.closeCoworkingSession(sessionId, payment.toLowerCase());

    res.json({
      message: 'Session closed successfully',
      session: result.session,
      record: result.record,
      total: result.session.total,
      duration: new CoworkingSession(result.session).getFormattedDuration()
    });

  } catch (error) {
    console.error('Close session error:', error);
    res.status(500).json({
      error: 'Failed to close session'
    });
  }
});

// Cancel session
router.delete('/:id', auth, canManageCoworking, async (req, res) => {
  try {
    const sessionId = req.params.id;

    // Check if session exists
    const sessionData = await databaseManager.getCoworkingSessionById(sessionId);
    if (!sessionData) {
      return res.status(404).json({
        error: 'Session not found'
      });
    }

    if (sessionData.status !== 'active') {
      return res.status(400).json({
        error: 'Can only cancel active sessions'
      });
    }

    // Cancel session
    const session = new CoworkingSession(sessionData);
    session.cancelSession();
    
    const updatedSession = await databaseManager.updateCoworkingSession(sessionId, session.toJSON());

    // Restore product stock for products that were added
    for (const product of sessionData.products) {
      await databaseManager.updateProductStock(product.productId, product.quantity, 'add');
    }

    res.json({
      message: 'Session cancelled successfully',
      session: updatedSession
    });

  } catch (error) {
    console.error('Cancel session error:', error);
    res.status(500).json({
      error: 'Failed to cancel session'
    });
  }
});

// Remove product from session
router.delete('/:id/products/:productId', auth, canManageCoworking, async (req, res) => {
  try {
    const { id: sessionId, productId } = req.params;
    const { quantity } = req.body; // Optional: remove specific quantity

    // Check if session exists and is active
    const sessionData = await databaseManager.getCoworkingSessionById(sessionId);
    if (!sessionData) {
      return res.status(404).json({
        error: 'Session not found'
      });
    }

    if (sessionData.status !== 'active') {
      return res.status(400).json({
        error: 'Cannot modify closed session'
      });
    }

    // Find product in session
    const productInSession = sessionData.products.find(p => p.productId === productId);
    if (!productInSession) {
      return res.status(404).json({
        error: 'Product not found in session'
      });
    }

    // Calculate quantity to restore to stock
    const quantityToRestore = quantity ? Math.min(parseInt(quantity), productInSession.quantity) : productInSession.quantity;

    // Remove product from session
    const session = new CoworkingSession(sessionData);
    session.removeProduct(productId, quantity ? parseInt(quantity) : null);

    // Update session in database
    const updatedSession = await databaseManager.updateCoworkingSession(sessionId, session.toJSON());

    // Restore product stock
    await databaseManager.updateProductStock(productId, quantityToRestore, 'add');

    res.json({
      message: 'Product removed from session successfully',
      session: updatedSession
    });

  } catch (error) {
    console.error('Remove product from session error:', error);
    res.status(500).json({
      error: 'Failed to remove product from session'
    });
  }
});

// Get session statistics
router.get('/stats/summary', auth, async (req, res) => {
  try {
    const sessions = await databaseManager.getCoworkingSessions();
    const activeSessions = sessions.filter(s => s.status === 'active');
    
    // Calculate statistics
    const totalSessions = sessions.length;
    const activeCount = activeSessions.length;
    const closedCount = sessions.filter(s => s.status === 'closed').length;
    const cancelledCount = sessions.filter(s => s.status === 'cancelled').length;
    
    // Calculate revenue from closed sessions
    const totalRevenue = sessions
      .filter(s => s.status === 'closed')
      .reduce((sum, s) => sum + s.total, 0);
    
    // Calculate active sessions current total
    const currentActiveTotal = activeSessions.reduce((sum, sessionData) => {
      const session = new CoworkingSession(sessionData);
      session.calculateTotals();
      return sum + session.total;
    }, 0);
    
    // Today's sessions
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const todaySessions = sessions.filter(s => new Date(s.createdAt) >= todayStart);
    
    res.json({
      summary: {
        totalSessions,
        activeCount,
        closedCount,
        cancelledCount,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        currentActiveTotal: Math.round(currentActiveTotal * 100) / 100
      },
      today: {
        sessionsStarted: todaySessions.length,
        sessionsClosed: todaySessions.filter(s => s.status === 'closed').length,
        todayRevenue: Math.round(
          todaySessions
            .filter(s => s.status === 'closed')
            .reduce((sum, s) => sum + s.total, 0) * 100
        ) / 100
      }
    });

  } catch (error) {
    console.error('Get session stats error:', error);
    res.status(500).json({
      error: 'Failed to fetch session statistics'
    });
  }
});

module.exports = router;