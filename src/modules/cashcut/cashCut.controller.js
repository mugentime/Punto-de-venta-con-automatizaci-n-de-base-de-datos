/**
 * Controlador Unificado de Cortes de Caja
 * 🔧 TaskMaster: Unified Cash Cut Controller
 */

const cashCutService = require('./cashCut.service');
const databaseManager = require('../../../utils/databaseManager');

class CashCutController {
    /**
     * 📋 Get all cash cuts with new API format
     */
    async getCashCuts(req, res) {
        try {
            const { limit = 50, offset = 0, from, to, status } = req.query;
            
            // Use new database manager method for consistency
            const cashCuts = await databaseManager.listCashCuts({
                limit: parseInt(limit),
                offset: parseInt(offset),
                from,
                to,
                status
            });

            // Return in new API format (direct array)
            res.json(cashCuts);
        } catch (error) {
            console.error('Error getting cash cuts:', error);
            res.status(500).json({
                error: 'Failed to retrieve cash cuts',
                message: error.message
            });
        }
    }
    
    /**
     * 🔓 Get open cash cut
     */
    async getOpenCashCut(req, res) {
        try {
            const openCut = await databaseManager.getOpenCashCut();
            
            if (!openCut) {
                return res.status(404).json({
                    error: 'No open cash cut found'
                });
            }

            res.json(openCut);
        } catch (error) {
            console.error('Error getting open cash cut:', error);
            res.status(500).json({
                error: 'Failed to retrieve open cash cut',
                message: error.message
            });
        }
    }
    
    /**
     * 🆕 Create new cash cut
     */
    async createCashCut(req, res) {
        try {
            const { openingAmount, openedBy, notes } = req.body;
            
            // Validation
            if (!openingAmount || openingAmount < 0) {
                return res.status(400).json({
                    error: 'Opening amount is required and must be non-negative'
                });
            }
            
            if (!openedBy) {
                return res.status(400).json({
                    error: 'openedBy is required'
                });
            }
            
            const cashCut = await databaseManager.createCashCut({
                openingAmount: parseFloat(openingAmount),
                openedBy,
                notes: notes || ''
            });

            // Broadcast cash cut creation for real-time sync
            if (req.app.locals.broadcast) {
                req.app.locals.broadcast('cash', 'create', cashCut);
            }

            res.status(201).json(cashCut);
        } catch (error) {
            console.error('Error creating cash cut:', error);
            if (error.message.includes('already an open cash cut')) {
                return res.status(409).json({
                    error: error.message
                });
            }
            res.status(500).json({
                error: 'Failed to create cash cut',
                message: error.message
            });
        }
    }
    
    /**
     * 🔒 Close cash cut
     */
    async closeCashCut(req, res) {
        try {
            const { id } = req.params;
            const { closingAmount, closedBy, notes } = req.body;
            
            // Validation
            if (closingAmount === undefined || closingAmount === null) {
                return res.status(400).json({
                    error: 'Closing amount is required'
                });
            }
            
            if (!closedBy) {
                return res.status(400).json({
                    error: 'closedBy is required'
                });
            }
            
            const cashCut = await databaseManager.closeCashCut({
                id,
                closingAmount: parseFloat(closingAmount),
                closedBy,
                notes: notes || ''
            });

            // Broadcast cash cut closure for real-time sync
            if (req.app.locals.broadcast) {
                req.app.locals.broadcast('cash', 'update', cashCut);
            }

            res.json(cashCut);
        } catch (error) {
            console.error('Error closing cash cut:', error);
            if (error.message.includes('not found')) {
                return res.status(404).json({
                    error: error.message
                });
            }
            if (error.message.includes('not open')) {
                return res.status(409).json({
                    error: error.message
                });
            }
            res.status(500).json({
                error: 'Failed to close cash cut',
                message: error.message
            });
        }
    }
    
    /**
     * 📝 Add entry to cash cut
     */
    async addEntry(req, res) {
        try {
            const { id } = req.params;
            const { type, amount, referenceId, note } = req.body;
            
            // Validation
            if (!type || !['sale', 'expense', 'adjustment'].includes(type)) {
                return res.status(400).json({
                    error: 'Invalid entry type. Must be sale, expense, or adjustment'
                });
            }
            
            if (!amount || isNaN(parseFloat(amount))) {
                return res.status(400).json({
                    error: 'Valid amount is required'
                });
            }
            
            const updatedCashCut = await databaseManager.appendEntry(id, {
                type,
                amount: parseFloat(amount),
                referenceId,
                note
            });

            // Broadcast cash cut entry addition for real-time sync
            if (req.app.locals.broadcast) {
                req.app.locals.broadcast('cash', 'update', updatedCashCut);
            }

            res.json(updatedCashCut);
        } catch (error) {
            console.error('Error adding entry to cash cut:', error);
            if (error.message.includes('not found')) {
                return res.status(404).json({
                    error: error.message
                });
            }
            if (error.message.includes('not open')) {
                return res.status(409).json({
                    error: error.message
                });
            }
            res.status(500).json({
                error: 'Failed to add entry to cash cut',
                message: error.message
            });
        }
    }

    /**
     * 🔍 Get specific cash cut by ID
     */
    async getCashCutById(req, res) {
        try {
            const cashCut = await databaseManager.getCashCutById(req.params.id);

            if (!cashCut) {
                return res.status(404).json({
                    error: 'Cash cut not found'
                });
            }

            res.json(cashCut);
        } catch (error) {
            console.error('Error getting cash cut:', error);
            res.status(500).json({
                error: 'Failed to retrieve cash cut',
                message: error.message
            });
        }
    }

    /**
     * 🔍 Get detailed cash cut report with all cash transactions
     * Returns all cash income (sales) and expenses within the cut period
     */
    async getCashCutDetails(req, res) {
        try {
            const { id } = req.params;

            // Get the cash cut
            const cashCut = await databaseManager.getCashCutById(id);

            if (!cashCut) {
                return res.status(404).json({
                    error: 'Corte de caja no encontrado'
                });
            }

            // Determine the date range for this cash cut
            const startDate = new Date(cashCut.openedAt || cashCut.createdAt);
            const endDate = cashCut.closedAt ? new Date(cashCut.closedAt) : new Date();

            // Get all cash sales (ingresos en efectivo) within the period
            const allSales = await databaseManager.listRecords({
                limit: 10000,
                from: startDate.toISOString(),
                to: endDate.toISOString()
            });

            const cashSales = allSales.filter(sale =>
                (sale.payment || sale.paymentMethod || '').toLowerCase() === 'efectivo'
            );

            // Get all cash expenses (egresos en efectivo) within the period
            const allExpenses = await databaseManager.listExpenses({
                limit: 10000,
                from: startDate.toISOString(),
                to: endDate.toISOString()
            });

            const cashExpenses = allExpenses.filter(expense =>
                (expense.payment_method || expense.paymentMethod || '').toLowerCase() === 'efectivo'
            );

            // Calculate totals
            const totalCashIncome = cashSales.reduce((sum, sale) => sum + parseFloat(sale.total || 0), 0);
            const totalCashExpenses = cashExpenses.reduce((sum, expense) => sum + parseFloat(expense.amount || 0), 0);

            const openingAmount = parseFloat(cashCut.openingAmount || 0);
            const expectedCash = openingAmount + totalCashIncome - totalCashExpenses;
            const actualCash = parseFloat(cashCut.closingAmount || 0);
            const difference = actualCash - expectedCash;

            // Format response
            const details = {
                cashCut: {
                    id: cashCut.id,
                    status: cashCut.status,
                    openedAt: cashCut.openedAt || cashCut.createdAt,
                    closedAt: cashCut.closedAt,
                    openedBy: cashCut.openedBy,
                    closedBy: cashCut.closedBy,
                    notes: cashCut.notes || '',
                    openingAmount,
                    closingAmount: actualCash,
                    expectedAmount: expectedCash,
                    difference
                },
                cashIncome: {
                    transactions: cashSales.map(sale => ({
                        id: sale.id || sale._id,
                        date: sale.createdAt || sale.date,
                        client: sale.client || sale.clientName || 'Cliente',
                        service: sale.service || sale.serviceType,
                        amount: parseFloat(sale.total || 0),
                        products: sale.products || sale.items || []
                    })),
                    total: totalCashIncome,
                    count: cashSales.length
                },
                cashExpenses: {
                    transactions: cashExpenses.map(expense => ({
                        id: expense.id || expense._id,
                        date: expense.createdAt || expense.date,
                        category: expense.category,
                        description: expense.description,
                        amount: parseFloat(expense.amount || 0)
                    })),
                    total: totalCashExpenses,
                    count: cashExpenses.length
                },
                summary: {
                    openingAmount,
                    totalIncome: totalCashIncome,
                    totalExpenses: totalCashExpenses,
                    expectedCash,
                    actualCash,
                    difference,
                    differencePercentage: expectedCash > 0 ? ((difference / expectedCash) * 100).toFixed(2) : 0
                }
            };

            res.json(details);
        } catch (error) {
            console.error('Error getting cash cut details:', error);
            res.status(500).json({
                error: 'Error al obtener detalles del corte de caja',
                message: error.message
            });
        }
    }

    /**
     * ✋ Trigger manual cash cut
     */
    async triggerManualCut(req, res) {
        try {
            const { notes = '' } = req.body;
            const userId = req.user?.userId || req.user?.id || 'unknown-user';

            console.log(`🔄 Manual cash cut requested by user: ${userId}`);
            
            const cashCut = await cashCutService.triggerManualCut(userId, notes);

            // Broadcast manual cash cut for real-time sync
            if (req.app.locals.broadcast) {
                req.app.locals.broadcast('cash', 'create', cashCut);
            }

            res.json({
                success: true,
                message: 'Manual cash cut completed successfully',
                cashCut
            });
        } catch (error) {
            console.error('Error performing manual cash cut:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to perform manual cash cut',
                message: error.message
            });
        }
    }

    /**
     * 🤖 Trigger automatic cash cut (on-demand)
     */
    async triggerAutomaticCut(req, res) {
        try {
            const userId = req.user?.userId || req.user?.id || 'system-auto';
            
            console.log(`🔄 Automatic cash cut requested by: ${userId}`);
            
            const cashCut = await cashCutService.performAutomaticCashCut();

            res.json({
                success: true,
                message: 'Automatic cash cut completed successfully',
                cashCut
            });
        } catch (error) {
            console.error('Error performing automatic cash cut:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to perform automatic cash cut',
                message: error.message
            });
        }
    }

    /**
     * 📊 Get cash cut statistics for reports
     */
    async getStatistics(req, res) {
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

            const cashCuts = await cashCutService.getCashCuts();
            const periodCuts = cashCuts.filter(cut => new Date(cut.cutDate) >= startDate);

            const stats = {
                totalCuts: periodCuts.length,
                totalIncome: periodCuts.reduce((sum, cut) => sum + (cut.totalIncome || 0), 0),
                totalProfit: periodCuts.reduce((sum, cut) => sum + (cut.totalProfit || 0), 0),
                totalExpenses: periodCuts.reduce((sum, cut) => sum + (cut.totalExpenses || 0), 0),
                netProfit: periodCuts.reduce((sum, cut) => sum + (cut.netProfit || cut.totalProfit || 0), 0),
                averageIncome: periodCuts.length > 0 ? 
                    periodCuts.reduce((sum, cut) => sum + (cut.totalIncome || 0), 0) / periodCuts.length : 0,
                averageProfit: periodCuts.length > 0 ? 
                    periodCuts.reduce((sum, cut) => sum + (cut.totalProfit || 0), 0) / periodCuts.length : 0,
                totalRecords: periodCuts.reduce((sum, cut) => sum + (cut.totalRecords || 0), 0),
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
            Object.keys(stats).forEach(key => {
                if (typeof stats[key] === 'number') {
                    stats[key] = Math.round(stats[key] * 100) / 100;
                }
            });

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
                error: 'Failed to retrieve cash cut statistics',
                message: error.message
            });
        }
    }

    /**
     * 📈 Get charts data for cash cuts
     */
    async getChartsData(req, res) {
        try {
            const { days = 30 } = req.query;
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - parseInt(days));

            const cashCuts = await cashCutService.getCashCuts();
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
                        expenses: 0,
                        netProfit: 0,
                        records: 0,
                        cuts: 0
                    };
                }
                dailyData[dateKey].income += cut.totalIncome || 0;
                dailyData[dateKey].profit += cut.totalProfit || 0;
                dailyData[dateKey].expenses += cut.totalExpenses || 0;
                dailyData[dateKey].netProfit += cut.netProfit || cut.totalProfit || 0;
                dailyData[dateKey].records += cut.totalRecords || 0;
                dailyData[dateKey].cuts += 1;
            });

            // Convert to array and sort
            const chartData = Object.values(dailyData)
                .sort((a, b) => new Date(a.date) - new Date(b.date))
                .map(day => ({
                    ...day,
                    income: Math.round(day.income * 100) / 100,
                    profit: Math.round(day.profit * 100) / 100,
                    expenses: Math.round(day.expenses * 100) / 100,
                    netProfit: Math.round(day.netProfit * 100) / 100
                }));

            res.json({
                success: true,
                chartData
            });
        } catch (error) {
            console.error('Error getting chart data:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve chart data',
                message: error.message
            });
        }
    }

    /**
     * 📊 Get service status
     */
    async getServiceStatus(req, res) {
        try {
            const status = cashCutService.getStatus();
            
            res.json({
                success: true,
                serviceStatus: status
            });
        } catch (error) {
            console.error('Error getting service status:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve service status',
                message: error.message
            });
        }
    }

    /**
     * 🔄 Initialize service (admin only)
     */
    async initializeService(req, res) {
        try {
            // Only allow admin users to initialize
            if (req.user?.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    error: 'Only administrators can initialize the service'
                });
            }

            const { settings } = req.body;
            
            await cashCutService.init({ 
                settings: {
                    cron: process.env.CASHCUT_CRON || '0 0,12 * * *',
                    timezone: process.env.TZ || 'America/Mexico_City',
                    ...settings
                }
            });

            res.json({
                success: true,
                message: 'Cash cut service initialized successfully',
                status: cashCutService.getStatus()
            });
        } catch (error) {
            console.error('Error initializing service:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to initialize service',
                message: error.message
            });
        }
    }

    /**
     * 🗑️ Delete cash cut (soft delete, admin only)
     */
    async deleteCashCut(req, res) {
        try {
            // Only allow admin users to delete cash cuts
            if (req.user?.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    error: 'Only administrators can delete cash cuts'
                });
            }

            // For now, we'll implement this as a placeholder
            // The actual deletion would depend on the database implementation
            res.status(501).json({
                success: false,
                error: 'Cash cut deletion not yet implemented',
                message: 'This feature will be implemented in future versions'
            });
        } catch (error) {
            console.error('Error deleting cash cut:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to delete cash cut',
                message: error.message
            });
        }
    }
}

module.exports = new CashCutController();
