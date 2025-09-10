const express = require('express');
const databaseManager = require('../utils/databaseManager');
const { auth } = require('../middleware/auth');
const Expense = require('../models/Expense');

const router = express.Router();

// Permission middleware for expense management
const canManageExpenses = (req, res, next) => {
  if (req.user.role === 'admin' || req.user.permissions?.canViewReports) {
    next();
  } else {
    res.status(403).json({ error: 'Insufficient permissions for expense management' });
  }
};

// Get expense categories (requires authentication)
router.get('/categories', auth, canManageExpenses, async (req, res) => {
  try {
    console.log('📊 Categories endpoint accessed by user:', req.user.userId);
    
    const categories = Expense.getCategories();
    res.json(categories);
    
  } catch (error) {
    console.error('❌ Categories endpoint error:', error);
    res.status(500).json({
      error: 'Failed to fetch categories'
    });
  }
});

// Get expense statistics (requires authentication)
router.get('/stats', auth, canManageExpenses, async (req, res) => {
  try {
    console.log('📊 Expense stats endpoint accessed by user:', req.user.userId);
    
    const stats = await databaseManager.getExpenseStats();
    res.json(stats);
    
  } catch (error) {
    console.error('❌ Expense stats endpoint error:', error);
    res.status(500).json({
      error: 'Failed to fetch expense statistics'
    });
  }
});

// Get financial report (requires authentication)
router.get('/financial-report/:period?', auth, canManageExpenses, async (req, res) => {
  try {
    console.log('💹 Financial report endpoint accessed by user:', req.user.userId);
    
    const period = req.params.period || 'current-month';
    let startDate, endDate;
    
    const now = new Date();
    
    switch (period) {
      case 'current-month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case 'last-month':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case 'current-year':
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now.getFullYear(), 11, 31);
        break;
      case 'last-3-months':
        startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    }
    
    const report = await databaseManager.getFinancialReport(startDate, endDate);
    res.json(report);
    
  } catch (error) {
    console.error('❌ Financial report endpoint error:', error);
    res.status(500).json({
      error: 'Failed to generate financial report'
    });
  }
});


// Get all expenses with optional filtering
router.get('/', auth, canManageExpenses, async (req, res) => {
  try {
    const { 
      category, 
      startDate, 
      endDate, 
      type, 
      status, 
      limit = 50, 
      sortBy = 'date', 
      order = 'desc' 
    } = req.query;
    
    let expenses = await databaseManager.getExpenses();
    
    // Apply filters
    if (category) {
      expenses = expenses.filter(e => e.category === category);
    }
    
    if (type) {
      expenses = expenses.filter(e => e.type === type);
    }
    
    if (status) {
      expenses = expenses.filter(e => e.status === status);
    }
    
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      expenses = expenses.filter(e => {
        const expenseDate = new Date(e.date);
        return expenseDate >= start && expenseDate <= end;
      });
    }
    
    // Sort expenses
    expenses.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'amount':
          aValue = a.amount;
          bValue = b.amount;
          break;
        case 'category':
          aValue = a.category;
          bValue = b.category;
          break;
        case 'date':
        default:
          aValue = new Date(a.date);
          bValue = new Date(b.date);
      }
      
      if (order === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });
    
    // Limit results
    expenses = expenses.slice(0, parseInt(limit));
    
    // Enrich with calculated fields
    const enrichedExpenses = expenses.map(expenseData => {
      const expense = new Expense(expenseData);
      return {
        ...expense.toJSON(),
        summary: expense.getSummary()
      };
    });
    
    res.json({
      expenses: enrichedExpenses,
      count: enrichedExpenses.length,
      filters: { category, startDate, endDate, type, status, sortBy, order }
    });

  } catch (error) {
    console.error('Get expenses error:', error);
    res.status(500).json({
      error: 'Failed to fetch expenses'
    });
  }
});

// Get expense by ID with detailed information
router.get('/:id', auth, canManageExpenses, async (req, res) => {
  try {
    const expenseData = await databaseManager.getExpenseById(req.params.id);
    
    if (!expenseData) {
      return res.status(404).json({
        error: 'Expense not found'
      });
    }
    
    const expense = new Expense(expenseData);
    
    res.json({
      expense: expense.toJSON(),
      summary: expense.getSummary(),
      categoryInfo: expense.getCategoryInfo(),
      subcategoryInfo: expense.getSubcategoryInfo()
    });

  } catch (error) {
    console.error('Get expense error:', error);
    res.status(500).json({
      error: 'Failed to fetch expense'
    });
  }
});

// Create new expense
router.post('/', auth, canManageExpenses, async (req, res) => {
  try {
    const {
      amount,
      description,
      category,
      subcategory,
      date,
      type,
      recurrenceFrequency,
      supplier,
      paymentMethod,
      invoiceNumber,
      taxDeductible,
      status,
      tags,
      notes
    } = req.body;

    // Validation
    if (!amount || amount <= 0) {
      return res.status(400).json({
        error: 'Amount is required and must be greater than 0'
      });
    }

    if (!description || description.trim().length === 0) {
      return res.status(400).json({
        error: 'Description is required'
      });
    }

    if (!category) {
      return res.status(400).json({
        error: 'Category is required'
      });
    }

    // Create expense using model
    const expense = new Expense({
      amount: parseFloat(amount),
      description: description.trim(),
      category,
      subcategory: subcategory || '',
      date: date ? new Date(date) : new Date(),
      type: type || 'unico',
      recurrenceFrequency: type === 'recurrente' ? recurrenceFrequency : null,
      supplier: supplier?.trim() || '',
      paymentMethod: paymentMethod || 'efectivo',
      invoiceNumber: invoiceNumber?.trim() || '',
      taxDeductible: taxDeductible || false,
      status: status || 'pagado',
      tags: Array.isArray(tags) ? tags : [],
      notes: notes?.trim() || '',
      createdBy: req.user.userId
    });

    // Validate expense
    const validation = expense.validate();
    if (!validation.isValid) {
      return res.status(400).json({
        error: 'Invalid expense data',
        details: validation.errors
      });
    }

    // Calculate next due date for recurring expenses
    if (expense.type === 'recurrente') {
      expense.nextDueDate = expense.calculateNextDueDate();
    }

    // Save to database
    const createdExpense = await databaseManager.createExpense(expense.toJSON());

    res.status(201).json({
      message: 'Expense created successfully',
      expense: createdExpense,
      summary: expense.getSummary()
    });

  } catch (error) {
    console.error('Create expense error:', error);
    res.status(500).json({
      error: 'Failed to create expense'
    });
  }
});

// Update expense
router.put('/:id', auth, canManageExpenses, async (req, res) => {
  try {
    const expenseData = await databaseManager.getExpenseById(req.params.id);
    
    if (!expenseData) {
      return res.status(404).json({
        error: 'Expense not found'
      });
    }

    // Create updated expense object
    const updatedExpense = new Expense({
      ...expenseData,
      ...req.body,
      updatedAt: new Date()
    });

    // Validate updated expense
    const validation = updatedExpense.validate();
    if (!validation.isValid) {
      return res.status(400).json({
        error: 'Invalid expense data',
        details: validation.errors
      });
    }

    // Update next due date for recurring expenses
    if (updatedExpense.type === 'recurrente') {
      updatedExpense.nextDueDate = updatedExpense.calculateNextDueDate();
    }

    // Save to database
    const savedExpense = await databaseManager.updateExpense(req.params.id, updatedExpense.toJSON());

    res.json({
      message: 'Expense updated successfully',
      expense: savedExpense,
      summary: updatedExpense.getSummary()
    });

  } catch (error) {
    console.error('Update expense error:', error);
    res.status(500).json({
      error: 'Failed to update expense'
    });
  }
});

// Delete expense (soft delete)
router.delete('/:id', auth, canManageExpenses, async (req, res) => {
  try {
    const expenseData = await databaseManager.getExpenseById(req.params.id);
    
    if (!expenseData) {
      return res.status(404).json({
        error: 'Expense not found'
      });
    }

    await databaseManager.deleteExpense(req.params.id);

    res.json({
      message: 'Expense deleted successfully'
    });

  } catch (error) {
    console.error('Delete expense error:', error);
    res.status(500).json({
      error: 'Failed to delete expense'
    });
  }
});

// Mark recurring expense as paid and generate next occurrence
router.post('/:id/pay', auth, canManageExpenses, async (req, res) => {
  try {
    const expenseData = await databaseManager.getExpenseById(req.params.id);
    
    if (!expenseData) {
      return res.status(404).json({
        error: 'Expense not found'
      });
    }

    const expense = new Expense(expenseData);
    
    if (expense.type !== 'recurrente') {
      return res.status(400).json({
        error: 'This endpoint is only for recurring expenses'
      });
    }

    // Mark as paid and calculate next due date
    expense.markAsPaid();

    // Update in database
    await databaseManager.updateExpense(req.params.id, expense.toJSON());

    res.json({
      message: 'Recurring expense marked as paid',
      expense: expense.toJSON(),
      nextDueDate: expense.nextDueDate
    });

  } catch (error) {
    console.error('Pay recurring expense error:', error);
    res.status(500).json({
      error: 'Failed to mark expense as paid'
    });
  }
});

// Get overdue expenses
router.get('/status/overdue', auth, canManageExpenses, async (req, res) => {
  try {
    const overdueExpenses = await databaseManager.getOverdueExpenses();
    
    const enrichedExpenses = overdueExpenses.map(expenseData => {
      const expense = new Expense(expenseData);
      return {
        ...expense.toJSON(),
        summary: expense.getSummary(),
        daysPastDue: Math.ceil((new Date() - new Date(expense.nextDueDate)) / (1000 * 60 * 60 * 24))
      };
    });

    res.json({
      expenses: enrichedExpenses,
      count: enrichedExpenses.length,
      totalAmount: enrichedExpenses.reduce((sum, e) => sum + e.amount, 0)
    });

  } catch (error) {
    console.error('Get overdue expenses error:', error);
    res.status(500).json({
      error: 'Failed to fetch overdue expenses'
    });
  }
});

// Get expenses by category
router.get('/category/:category', auth, canManageExpenses, async (req, res) => {
  try {
    const expenses = await databaseManager.getExpensesByCategory(req.params.category);
    
    const enrichedExpenses = expenses.map(expenseData => {
      const expense = new Expense(expenseData);
      return {
        ...expense.toJSON(),
        summary: expense.getSummary()
      };
    });

    res.json({
      category: req.params.category,
      expenses: enrichedExpenses,
      count: enrichedExpenses.length,
      totalAmount: enrichedExpenses.reduce((sum, e) => sum + e.amount, 0)
    });

  } catch (error) {
    console.error('Get expenses by category error:', error);
    res.status(500).json({
      error: 'Failed to fetch expenses by category'
    });
  }
});

module.exports = router;
