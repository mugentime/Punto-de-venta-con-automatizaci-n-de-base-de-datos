const express = require('express');
const databaseManager = require('../utils/databaseManager');
const { auth } = require('../middleware/auth-file');
const Customer = require('../models/Customer');

const router = express.Router();

// TEMPORARY: Public endpoint for development/demo - NO AUTH REQUIRED
router.get('/public', async (req, res) => {
  try {
    console.log('📊 Public customers endpoint accessed');
    
    let customers = await databaseManager.getCustomers();
    
    // Transform the data to include the information expected by the UI
    const enrichedCustomers = customers.map(customerData => {
      return {
        id: customerData.id || customerData._id,
        name: customerData.name,
        email: customerData.email || null,
        phone: customerData.phone || null,
        birthDate: customerData.birthDate || null,
        gender: customerData.gender || null,
        occupation: customerData.occupation || null,
        notes: customerData.notes || null,
        totalVisits: customerData.totalVisits || 0,
        totalSpent: customerData.totalSpent || 0,
        loyaltyPoints: customerData.loyaltyPoints || 0,
        lastVisitDate: customerData.lastVisitDate || null,
        membershipEndDate: customerData.membershipEndDate || null,
        createdAt: customerData.createdAt || new Date(),
        updatedAt: customerData.updatedAt || new Date()
      };
    });
    
    console.log(`📈 Returning ${enrichedCustomers.length} customers`);
    res.json(enrichedCustomers);
    
  } catch (error) {
    console.error('❌ Public customers endpoint error:', error);
    res.status(500).json({
      error: 'Failed to fetch customers'
    });
  }
});

// TEMPORARY: Public search endpoint for development/demo - NO AUTH REQUIRED
router.get('/search/:query', async (req, res) => {
  try {
    const query = req.params.query.toLowerCase().trim();
    console.log(`🔍 Search customers endpoint accessed with query: "${query}"`);
    
    if (query.length < 1) {
      return res.json([]);
    }
    
    let customers = await databaseManager.getCustomers();
    
    // Filtrar clientes que coincidan con la búsqueda
    const filteredCustomers = customers.filter(customer => {
      const name = customer.name ? customer.name.toLowerCase() : '';
      const email = customer.email ? customer.email.toLowerCase() : '';
      const phone = customer.phone ? customer.phone.toString().toLowerCase() : '';
      
      return name.includes(query) || email.includes(query) || phone.includes(query);
    });
    
    // Limitar a los primeros 10 resultados y transformar datos
    const searchResults = filteredCustomers.slice(0, 10).map(customerData => {
      return {
        id: customerData.id || customerData._id,
        name: customerData.name,
        email: customerData.email || null,
        phone: customerData.phone || null,
        totalVisits: customerData.totalVisits || 0,
        totalSpent: customerData.totalSpent || 0,
        membershipEndDate: customerData.membershipEndDate || null,
        // Información adicional para mostrar en el autocompletar
        display: customerData.name + (customerData.phone ? ` (${customerData.phone})` : '') + (customerData.email ? ` - ${customerData.email}` : ''),
        isVIP: customerData.membershipEndDate && new Date(customerData.membershipEndDate) > new Date()
      };
    });
    
    console.log(`📋 Returning ${searchResults.length} search results`);
    res.json(searchResults);
    
  } catch (error) {
    console.error('❌ Search customers endpoint error:', error);
    res.status(500).json({
      error: 'Failed to search customers'
    });
  }
});

// Permission middleware
const canManageCustomers = (req, res, next) => {
  if (req.user.role === 'admin' || req.user.permissions?.canRegisterClients) {
    next();
  } else {
    res.status(403).json({ error: 'Insufficient permissions for customer management' });
  }
};

// Get all customers with optional filtering
router.get('/', auth, async (req, res) => {
  try {
    const { search, segment, status, loyaltyTier, limit = 50, sortBy = 'lastVisit', order = 'desc' } = req.query;
    
    let customers = await databaseManager.getCustomers();
    
    // Apply filters
    if (search) {
      customers = await databaseManager.searchCustomers(search);
    }
    
    if (status) {
      customers = customers.filter(c => c.status === status);
    }
    
    if (loyaltyTier) {
      customers = customers.filter(c => c.loyaltyTier === loyaltyTier);
    }
    
    if (segment) {
      customers = customers.filter(c => {
        const customerObj = new Customer(c);
        return customerObj.getSegment() === segment;
      });
    }
    
    // Sort customers
    customers.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'totalSpent':
          aValue = a.totalSpent;
          bValue = b.totalSpent;
          break;
        case 'totalVisits':
          aValue = a.totalVisits;
          bValue = b.totalVisits;
          break;
        case 'lastVisit':
        default:
          aValue = new Date(a.lastVisit);
          bValue = new Date(b.lastVisit);
      }
      
      if (order === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });
    
    // Limit results
    customers = customers.slice(0, parseInt(limit));
    
    // Enrich with calculated fields
    const enrichedCustomers = customers.map(customerData => {
      const customer = new Customer(customerData);
      return {
        ...customer.toJSON(),
        summary: customer.getSummary()
      };
    });
    
    res.json({
      customers: enrichedCustomers,
      count: enrichedCustomers.length,
      filters: { search, segment, status, loyaltyTier, sortBy, order }
    });

  } catch (error) {
    console.error('Get customers error:', error);
    res.status(500).json({
      error: 'Failed to fetch customers'
    });
  }
});

// Get customer by ID with detailed information
router.get('/:id', auth, async (req, res) => {
  try {
    const customerData = await databaseManager.getCustomerById(req.params.id);
    
    if (!customerData) {
      return res.status(404).json({
        error: 'Customer not found'
      });
    }
    
    const customer = new Customer(customerData);
    
    // Get customer's records for detailed history
    const allRecords = await databaseManager.getRecords();
    const customerRecords = allRecords
      .filter(r => r.client.toLowerCase() === customer.name.toLowerCase() && !r.isDeleted)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 20); // Last 20 records
    
    // Get customer's coworking sessions
    const allSessions = await databaseManager.getCoworkingSessions();
    const customerSessions = allSessions
      .filter(s => s.client.toLowerCase() === customer.name.toLowerCase())
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 10); // Last 10 sessions
    
    res.json({
      customer: customer.toJSON(),
      summary: customer.getSummary(),
      recentRecords: customerRecords,
      recentSessions: customerSessions,
      favoriteProducts: customer.getFavoriteProducts(10),
      analytics: {
        segment: customer.getSegment(),
        tierColor: customer.getTierColor(),
        lifetimeValue: customer.getLifetimeValue(),
        daysSinceLastVisit: customer.getDaysSinceLastVisit(),
        isAtRisk: customer.isAtRisk(),
        preferredPayment: customer.getPreferredPaymentMethod()
      }
    });

  } catch (error) {
    console.error('Get customer error:', error);
    res.status(500).json({
      error: 'Failed to fetch customer'
    });
  }
});

// Create new customer
router.post('/', auth, canManageCustomers, async (req, res) => {
  try {
    const { name, email, phone, birthDate, notes, tags } = req.body;

    // Validation
    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        error: 'Customer name is required'
      });
    }

    // Check if customer already exists
    const existingCustomer = await databaseManager.getCustomerByName(name.trim());
    if (existingCustomer) {
      return res.status(400).json({
        error: 'Customer with this name already exists'
      });
    }

    // Create customer using model
    const customer = new Customer({
      name: name.trim(),
      email: email?.trim(),
      phone: phone?.trim(),
      birthDate,
      notes: notes?.trim(),
      tags: Array.isArray(tags) ? tags : [],
      createdBy: req.user.userId
    });

    // Validate customer
    const validation = customer.validate();
    if (!validation.isValid) {
      return res.status(400).json({
        error: 'Invalid customer data',
        details: validation.errors
      });
    }

    // Save to database
    const createdCustomer = await databaseManager.createCustomer(customer.toJSON());

    res.status(201).json({
      message: 'Customer created successfully',
      customer: createdCustomer,
      summary: customer.getSummary()
    });

  } catch (error) {
    console.error('Create customer error:', error);
    res.status(500).json({
      error: 'Failed to create customer'
    });
  }
});

// Update customer
router.put('/:id', auth, canManageCustomers, async (req, res) => {
  try {
    const { name, email, phone, birthDate, notes, tags, status } = req.body;
    const customerId = req.params.id;

    // Check if customer exists
    const customerData = await databaseManager.getCustomerById(customerId);
    if (!customerData) {
      return res.status(404).json({
        error: 'Customer not found'
      });
    }

    // Prepare update data
    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (email !== undefined) updateData.email = email?.trim();
    if (phone !== undefined) updateData.phone = phone?.trim();
    if (birthDate !== undefined) updateData.birthDate = birthDate;
    if (notes !== undefined) updateData.notes = notes?.trim();
    if (tags !== undefined) updateData.tags = Array.isArray(tags) ? tags : [];
    if (status !== undefined) updateData.status = status;

    // Validate updated data
    if (updateData.name || updateData.email || updateData.phone) {
      const tempCustomer = new Customer({ ...customerData, ...updateData });
      const validation = tempCustomer.validate();
      if (!validation.isValid) {
        return res.status(400).json({
          error: 'Invalid customer data',
          details: validation.errors
        });
      }
    }

    // Check for name conflicts
    if (updateData.name && updateData.name !== customerData.name) {
      const existingCustomer = await databaseManager.getCustomerByName(updateData.name);
      if (existingCustomer && existingCustomer._id !== customerId) {
        return res.status(400).json({
          error: 'Customer with this name already exists'
        });
      }
    }

    // Update customer
    const updatedCustomer = await databaseManager.updateCustomer(customerId, updateData);
    const customer = new Customer(updatedCustomer);

    res.json({
      message: 'Customer updated successfully',
      customer: updatedCustomer,
      summary: customer.getSummary()
    });

  } catch (error) {
    console.error('Update customer error:', error);
    res.status(500).json({
      error: 'Failed to update customer'
    });
  }
});

// Delete customer (soft delete)
router.delete('/:id', auth, canManageCustomers, async (req, res) => {
  try {
    const customerId = req.params.id;

    // Check if customer exists
    const customerData = await databaseManager.getCustomerById(customerId);
    if (!customerData) {
      return res.status(404).json({
        error: 'Customer not found'
      });
    }

    // Soft delete
    await databaseManager.deleteCustomer(customerId);

    res.json({
      message: 'Customer deleted successfully'
    });

  } catch (error) {
    console.error('Delete customer error:', error);
    res.status(500).json({
      error: 'Failed to delete customer'
    });
  }
});

// Search customers
router.get('/search/:query', auth, async (req, res) => {
  try {
    const { query } = req.params;
    const { limit = 10 } = req.query;

    if (!query || query.trim().length < 2) {
      return res.status(400).json({
        error: 'Search query must be at least 2 characters long'
      });
    }

    const customers = await databaseManager.searchCustomers(query);
    const limitedResults = customers.slice(0, parseInt(limit));

    // Return simplified customer data for autocomplete
    const suggestions = limitedResults.map(customer => ({
      id: customer._id,
      name: customer.name,
      email: customer.email,
      totalVisits: customer.totalVisits,
      totalSpent: customer.totalSpent,
      loyaltyTier: customer.loyaltyTier,
      lastVisit: customer.lastVisit
    }));

    res.json({
      suggestions,
      count: suggestions.length,
      query
    });

  } catch (error) {
    console.error('Search customers error:', error);
    res.status(500).json({
      error: 'Failed to search customers'
    });
  }
});

// Get customer statistics
router.get('/stats/summary', auth, async (req, res) => {
  try {
    const stats = await databaseManager.getCustomerStats();
    
    res.json({
      statistics: stats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Get customer stats error:', error);
    res.status(500).json({
      error: 'Failed to fetch customer statistics'
    });
  }
});

// Get customer analytics by segment
router.get('/analytics/segments', auth, async (req, res) => {
  try {
    const customers = await databaseManager.getCustomers();
    
    const segments = {
      new: [],
      occasional: [],
      regular: [],
      loyal: [],
      vip: []
    };
    
    customers.forEach(customerData => {
      const customer = new Customer(customerData);
      const segment = customer.getSegment();
      segments[segment].push({
        id: customer._id,
        name: customer.name,
        totalVisits: customer.totalVisits,
        totalSpent: customer.totalSpent,
        lastVisit: customer.lastVisit,
        loyaltyTier: customer.loyaltyTier
      });
    });
    
    // Sort each segment by total spent
    Object.keys(segments).forEach(segment => {
      segments[segment].sort((a, b) => b.totalSpent - a.totalSpent);
    });
    
    res.json({
      segments,
      summary: {
        new: segments.new.length,
        occasional: segments.occasional.length,
        regular: segments.regular.length,
        loyal: segments.loyal.length,
        vip: segments.vip.length,
        total: customers.length
      }
    });

  } catch (error) {
    console.error('Get customer analytics error:', error);
    res.status(500).json({
      error: 'Failed to fetch customer analytics'
    });
  }
});

// Get at-risk customers (haven't visited in 30+ days)
router.get('/analytics/at-risk', auth, async (req, res) => {
  try {
    const customers = await databaseManager.getCustomers();
    const { daysThreshold = 30 } = req.query;
    
    const atRiskCustomers = customers
      .map(customerData => {
        const customer = new Customer(customerData);
        return {
          ...customer.getSummary(),
          daysSinceLastVisit: customer.getDaysSinceLastVisit(),
          isAtRisk: customer.getDaysSinceLastVisit() > parseInt(daysThreshold)
        };
      })
      .filter(c => c.isAtRisk)
      .sort((a, b) => b.daysSinceLastVisit - a.daysSinceLastVisit);
    
    res.json({
      atRiskCustomers,
      count: atRiskCustomers.length,
      daysThreshold: parseInt(daysThreshold),
      recommendations: atRiskCustomers.slice(0, 5).map(customer => ({
        customerId: customer.id,
        name: customer.name,
        recommendation: `Send promotional offer - ${customer.daysSinceLastVisit} days since last visit`,
        urgency: customer.daysSinceLastVisit > 60 ? 'high' : customer.daysSinceLastVisit > 45 ? 'medium' : 'low'
      }))
    });

  } catch (error) {
    console.error('Get at-risk customers error:', error);
    res.status(500).json({
      error: 'Failed to fetch at-risk customers'
    });
  }
});

module.exports = router;
