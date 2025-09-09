/**
 * Controlador Unificado de Cortes de Caja
 * 🔧 TaskMaster: Unified Cash Cut Controller
 */

const cashCutService = require('./cashCut.service');

class CashCutController {
    /**
     * 📋 Get all cash cuts
     */
    async getCashCuts(req, res) {
        try {
            const { limit = 50, startDate, endDate } = req.query;
            let cashCuts;

            if (startDate && endDate) {
                // Get cash cuts for date range
                const allCuts = await cashCutService.getCashCuts(parseInt(limit));
                cashCuts = allCuts.filter(cut => {
                    const cutDate = new Date(cut.cutDate);
                    return cutDate >= new Date(startDate) && cutDate <= new Date(endDate);
                });
            } else {
                cashCuts = await cashCutService.getCashCuts(parseInt(limit));
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
                error: 'Failed to retrieve cash cuts',
                message: error.message
            });
        }
    }

    /**
     * 🔍 Get specific cash cut by ID
     */
    async getCashCutById(req, res) {
        try {
            const cashCut = await cashCutService.getCashCutById(req.params.id);
            
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
                error: 'Failed to retrieve cash cut',
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
                    cron: process.env.CASHCUT_CRON || '0 23 * * *',
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
