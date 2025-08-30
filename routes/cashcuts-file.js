const express = require('express');
const { auth } = require('../middleware/auth-file');
const databaseManager = require('../utils/databaseManager');
const cashCutService = require('../utils/cashCutService');

const router = express.Router();

// Get all cash cuts
router.get('/', auth, async (req, res) => {
  try {
    const { limit = 50, startDate, endDate } = req.query;
    let cashCuts;

    if (startDate && endDate) {
      // Get cash cuts for date range (implement if needed)
      const allCuts = await databaseManager.getCashCuts(limit);
      cashCuts = allCuts.filter(cut => {
        const cutDate = new Date(cut.cutDate);
        return cutDate >= new Date(startDate) && cutDate <= new Date(endDate);
      });
    } else {
      cashCuts = await databaseManager.getCashCuts(parseInt(limit));
    }

    res.json({
      success: true,
      cashCuts,
      total: cashCuts.length
    });
  } catch (error) {
    console.error('Error getting cash cuts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve cash cuts'
    });
  }
});

// Get specific cash cut by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const cashCut = await databaseManager.getCashCutById(req.params.id);
    
    if (!cashCut) {
      return res.status(404).json({
        success: false,
        error: 'Cash cut not found'
      });
    }

    res.json({
      success: true,
      cashCut
    });
  } catch (error) {
    console.error('Error getting cash cut:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve cash cut'
    });
  }
});

// Trigger manual cash cut
router.post('/manual', auth, async (req, res) => {
  try {
    const { notes = '' } = req.body;
    const userId = req.user.userId;

    const cashCut = await cashCutService.triggerManualCut(userId, notes);

    res.json({
      success: true,
      message: 'Manual cash cut completed successfully',
      cashCut
    });
  } catch (error) {
    console.error('Error performing manual cash cut:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to perform manual cash cut'
    });
  }
});

// Get cash cut statistics for reports
router.get('/stats/summary', auth, async (req, res) => {
  try {
    const { period = 'week' } = req.query;
    
    let startDate = new Date();
    switch (period) {
      case 'today':
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case 'year':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
    }

    const cashCuts = await databaseManager.getCashCuts();
    const periodCuts = cashCuts.filter(cut => new Date(cut.cutDate) >= startDate);

    const stats = {
      totalCuts: periodCuts.length,
      totalIncome: periodCuts.reduce((sum, cut) => sum + cut.totalIncome, 0),
      totalProfit: periodCuts.reduce((sum, cut) => sum + cut.totalProfit, 0),
      averageIncome: periodCuts.length > 0 ? 
        periodCuts.reduce((sum, cut) => sum + cut.totalIncome, 0) / periodCuts.length : 0,
      averageProfit: periodCuts.length > 0 ? 
        periodCuts.reduce((sum, cut) => sum + cut.totalProfit, 0) / periodCuts.length : 0,
      totalRecords: periodCuts.reduce((sum, cut) => sum + cut.totalRecords, 0),
      paymentBreakdown: {
        efectivo: periodCuts.reduce((sum, cut) => sum + (cut.paymentBreakdown?.efectivo?.amount || 0), 0),
        tarjeta: periodCuts.reduce((sum, cut) => sum + (cut.paymentBreakdown?.tarjeta?.amount || 0), 0),
        transferencia: periodCuts.reduce((sum, cut) => sum + (cut.paymentBreakdown?.transferencia?.amount || 0), 0)
      },
      serviceBreakdown: {
        cafeteria: periodCuts.reduce((sum, cut) => sum + (cut.serviceBreakdown?.cafeteria?.amount || 0), 0),
        coworking: periodCuts.reduce((sum, cut) => sum + (cut.serviceBreakdown?.coworking?.amount || 0), 0)
      }
    };

    // Round numbers
    stats.totalIncome = Math.round(stats.totalIncome * 100) / 100;
    stats.totalProfit = Math.round(stats.totalProfit * 100) / 100;
    stats.averageIncome = Math.round(stats.averageIncome * 100) / 100;
    stats.averageProfit = Math.round(stats.averageProfit * 100) / 100;

    Object.keys(stats.paymentBreakdown).forEach(key => {
      stats.paymentBreakdown[key] = Math.round(stats.paymentBreakdown[key] * 100) / 100;
    });

    Object.keys(stats.serviceBreakdown).forEach(key => {
      stats.serviceBreakdown[key] = Math.round(stats.serviceBreakdown[key] * 100) / 100;
    });

    res.json({
      success: true,
      period,
      stats
    });
  } catch (error) {
    console.error('Error getting cash cut statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve cash cut statistics'
    });
  }
});

// Get charts data for cash cuts
router.get('/charts/daily', auth, async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const cashCuts = await databaseManager.getCashCuts();
    const periodCuts = cashCuts.filter(cut => new Date(cut.cutDate) >= startDate);

    // Group by date
    const dailyData = {};
    periodCuts.forEach(cut => {
      const dateKey = new Date(cut.cutDate).toISOString().split('T')[0];
      if (!dailyData[dateKey]) {
        dailyData[dateKey] = {
          date: dateKey,
          income: 0,
          profit: 0,
          records: 0,
          cuts: 0
        };
      }
      dailyData[dateKey].income += cut.totalIncome;
      dailyData[dateKey].profit += cut.totalProfit;
      dailyData[dateKey].records += cut.totalRecords;
      dailyData[dateKey].cuts += 1;
    });

    // Convert to array and sort
    const chartData = Object.values(dailyData)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map(day => ({
        ...day,
        income: Math.round(day.income * 100) / 100,
        profit: Math.round(day.profit * 100) / 100
      }));

    res.json({
      success: true,
      chartData
    });
  } catch (error) {
    console.error('Error getting daily chart data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve daily chart data'
    });
  }
});

// Delete cash cut (soft delete)
router.delete('/:id', auth, async (req, res) => {
  try {
    // Only allow admin users to delete cash cuts
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only administrators can delete cash cuts'
      });
    }

    const deletedCut = await databaseManager.deleteCashCut(req.params.id, req.user.id);

    res.json({
      success: true,
      message: 'Cash cut deleted successfully',
      cashCut: deletedCut
    });
  } catch (error) {
    console.error('Error deleting cash cut:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete cash cut'
    });
  }
});

// Get cash cut service status
router.get('/service/status', auth, async (req, res) => {
  try {
    const status = cashCutService.getJobsStatus();
    
    res.json({
      success: true,
      serviceStatus: {
        initialized: cashCutService.initialized,
        lastCutTime: cashCutService.lastCutTime,
        jobs: status
      }
    });
  } catch (error) {
    console.error('Error getting service status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve service status'
    });
  }
});

module.exports = router;