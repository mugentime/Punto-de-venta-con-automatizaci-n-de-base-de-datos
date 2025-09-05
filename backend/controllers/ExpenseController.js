/**
 * Controlador de Gestión de Gastos - POS ConEJO NEGRO
 * 💼 Feature: API REST completa para gestión de gastos
 * 💰 TaskMaster: Expense Management REST API Controller
 */

const ExpenseManagementService = require('../services/ExpenseManagementService');

class ExpenseController {
    constructor() {
        this.expenseService = new ExpenseManagementService();
        console.log('🚀 TaskMaster: Expense Controller Inicializado');
    }

    /**
     * 💰 Crear nuevo gasto
     */
    async createExpense(req, res) {
        try {
            const result = await this.expenseService.createExpense(req.body);
            
            if (result.success) {
                res.status(201).json({
                    success: true,
                    message: result.message,
                    data: result.data
                });
            } else {
                res.status(400).json({
                    success: false,
                    error: result.error
                });
            }
        } catch (error) {
            console.error('❌ Error en createExpense:', error.message);
            res.status(500).json({
                success: false,
                error: 'Error interno del servidor'
            });
        }
    }

    /**
     * 🔍 Obtener gastos con filtros
     */
    async getExpenses(req, res) {
        try {
            const filters = {
                category: req.query.category,
                status: req.query.status,
                dateFrom: req.query.dateFrom,
                dateTo: req.query.dateTo,
                minAmount: req.query.minAmount ? parseFloat(req.query.minAmount) : undefined,
                maxAmount: req.query.maxAmount ? parseFloat(req.query.maxAmount) : undefined,
                requestedBy: req.query.requestedBy,
                page: req.query.page ? parseInt(req.query.page) : 1,
                limit: req.query.limit ? parseInt(req.query.limit) : 20,
                sortBy: req.query.sortBy || 'createdAt',
                sortOrder: req.query.sortOrder || 'desc'
            };

            const result = await this.expenseService.getExpenses(filters);
            
            if (result.success) {
                res.json({
                    success: true,
                    data: result.data
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: result.error
                });
            }
        } catch (error) {
            console.error('❌ Error en getExpenses:', error.message);
            res.status(500).json({
                success: false,
                error: 'Error interno del servidor'
            });
        }
    }

    /**
     * 📊 Obtener gasto por ID
     */
    async getExpenseById(req, res) {
        try {
            const { expenseId } = req.params;
            const expense = await this.expenseService.getExpenseById(expenseId);
            
            if (expense) {
                res.json({
                    success: true,
                    data: expense
                });
            } else {
                res.status(404).json({
                    success: false,
                    error: 'Gasto no encontrado'
                });
            }
        } catch (error) {
            console.error('❌ Error en getExpenseById:', error.message);
            res.status(500).json({
                success: false,
                error: 'Error interno del servidor'
            });
        }
    }

    /**
     * ✅ Aprobar gasto
     */
    async approveExpense(req, res) {
        try {
            const { expenseId } = req.params;
            const approverData = req.body;
            
            const result = await this.expenseService.approveExpense(expenseId, approverData);
            
            if (result.success) {
                res.json({
                    success: true,
                    message: result.message,
                    data: result.data
                });
            } else {
                res.status(400).json({
                    success: false,
                    error: result.error
                });
            }
        } catch (error) {
            console.error('❌ Error en approveExpense:', error.message);
            res.status(500).json({
                success: false,
                error: 'Error interno del servidor'
            });
        }
    }

    /**
     * ❌ Rechazar gasto
     */
    async rejectExpense(req, res) {
        try {
            const { expenseId } = req.params;
            const rejectorData = req.body;
            
            const result = await this.expenseService.rejectExpense(expenseId, rejectorData);
            
            if (result.success) {
                res.json({
                    success: true,
                    message: result.message,
                    data: result.data
                });
            } else {
                res.status(400).json({
                    success: false,
                    error: result.error
                });
            }
        } catch (error) {
            console.error('❌ Error en rejectExpense:', error.message);
            res.status(500).json({
                success: false,
                error: 'Error interno del servidor'
            });
        }
    }

    /**
     * 💳 Marcar gasto como pagado
     */
    async markAsPaid(req, res) {
        try {
            const { expenseId } = req.params;
            const paymentData = req.body;
            
            const result = await this.expenseService.markAsPaid(expenseId, paymentData);
            
            if (result.success) {
                res.json({
                    success: true,
                    message: result.message,
                    data: result.data
                });
            } else {
                res.status(400).json({
                    success: false,
                    error: result.error
                });
            }
        } catch (error) {
            console.error('❌ Error en markAsPaid:', error.message);
            res.status(500).json({
                success: false,
                error: 'Error interno del servidor'
            });
        }
    }

    /**
     * 📋 Obtener categorías de gastos
     */
    async getCategories(req, res) {
        try {
            const categories = this.expenseService.categories;
            
            res.json({
                success: true,
                data: {
                    categories: Object.keys(categories).map(key => ({
                        id: key,
                        ...categories[key]
                    })),
                    totalCategories: Object.keys(categories).length
                }
            });
        } catch (error) {
            console.error('❌ Error en getCategories:', error.message);
            res.status(500).json({
                success: false,
                error: 'Error interno del servidor'
            });
        }
    }

    /**
     * 📊 Generar reporte de gastos
     */
    async generateReport(req, res) {
        try {
            const { reportType = 'summary', period = 'current_month' } = req.body;
            
            const result = await this.expenseService.generateExpenseReport(reportType, period);
            
            if (result.success) {
                res.json({
                    success: true,
                    message: result.message,
                    data: result.data
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: result.error
                });
            }
        } catch (error) {
            console.error('❌ Error en generateReport:', error.message);
            res.status(500).json({
                success: false,
                error: 'Error interno del servidor'
            });
        }
    }

    /**
     * 📈 Obtener dashboard de gastos
     */
    async getDashboard(req, res) {
        try {
            const result = await this.expenseService.getExpenseDashboard();
            
            if (result.success) {
                res.json({
                    success: true,
                    data: result.data
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: result.error
                });
            }
        } catch (error) {
            console.error('❌ Error en getDashboard:', error.message);
            res.status(500).json({
                success: false,
                error: 'Error interno del servidor'
            });
        }
    }

    /**
     * 📊 Obtener estadísticas de gastos
     */
    async getExpenseStatistics(req, res) {
        try {
            const { period = 'current_year' } = req.query;
            
            // Obtener gastos para el período
            const expenses = await this.expenseService.getExpensesForPeriod(period);
            
            const statistics = {
                period: period,
                totalExpenses: expenses.length,
                totalAmount: expenses.reduce((sum, exp) => sum + exp.amount, 0),
                averageExpense: expenses.length > 0 ? 
                    expenses.reduce((sum, exp) => sum + exp.amount, 0) / expenses.length : 0,
                
                byStatus: {
                    approved: expenses.filter(e => e.status === 'approved').length,
                    pending: expenses.filter(e => e.status === 'pending_approval').length,
                    rejected: expenses.filter(e => e.status === 'rejected').length,
                    paid: expenses.filter(e => e.status === 'paid').length
                },
                
                byCategory: Object.keys(this.expenseService.categories).map(key => ({
                    category: key,
                    name: this.expenseService.categories[key].name,
                    icon: this.expenseService.categories[key].icon,
                    count: expenses.filter(e => e.category === key).length,
                    totalAmount: expenses.filter(e => e.category === key)
                        .reduce((sum, exp) => sum + exp.amount, 0),
                    percentage: expenses.length > 0 ? 
                        (expenses.filter(e => e.category === key).length / expenses.length * 100).toFixed(2) : 0
                })),
                
                monthlyTrend: this.generateMonthlyTrend(expenses),
                topExpenses: expenses
                    .sort((a, b) => b.amount - a.amount)
                    .slice(0, 10)
                    .map(exp => ({
                        id: exp.id,
                        description: exp.description,
                        amount: exp.amount,
                        category: exp.category,
                        vendor: exp.vendor,
                        status: exp.status,
                        createdAt: exp.createdAt
                    })),
                
                approvalMetrics: {
                    averageApprovalTime: this.expenseService.calculateAvgApprovalTime(expenses),
                    rejectionRate: this.expenseService.calculateRejectionRate(expenses),
                    pendingCount: expenses.filter(e => e.status === 'pending_approval').length
                }
            };
            
            res.json({
                success: true,
                data: statistics,
                generatedAt: new Date().toISOString()
            });
            
        } catch (error) {
            console.error('❌ Error en getExpenseStatistics:', error.message);
            res.status(500).json({
                success: false,
                error: 'Error interno del servidor'
            });
        }
    }

    /**
     * 🔍 Buscar gastos por texto
     */
    async searchExpenses(req, res) {
        try {
            const { 
                query, 
                searchIn = ['description', 'vendor', 'notes'],
                limit = 20 
            } = req.body;
            
            if (!query || query.trim().length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Consulta de búsqueda requerida'
                });
            }
            
            const allExpenses = await this.expenseService.getExpenses();
            const expenses = allExpenses.data?.expenses || [];
            
            const searchResults = expenses.filter(expense => {
                const searchText = query.toLowerCase();
                
                return searchIn.some(field => {
                    const fieldValue = expense[field];
                    return fieldValue && fieldValue.toString().toLowerCase().includes(searchText);
                });
            }).slice(0, limit);
            
            res.json({
                success: true,
                data: {
                    query: query,
                    searchIn: searchIn,
                    resultsCount: searchResults.length,
                    expenses: searchResults
                }
            });
            
        } catch (error) {
            console.error('❌ Error en searchExpenses:', error.message);
            res.status(500).json({
                success: false,
                error: 'Error interno del servidor'
            });
        }
    }

    /**
     * 🏷️ Obtener gastos por etiquetas
     */
    async getExpensesByTags(req, res) {
        try {
            const { tags } = req.query;
            
            if (!tags) {
                return res.status(400).json({
                    success: false,
                    error: 'Etiquetas requeridas'
                });
            }
            
            const tagArray = Array.isArray(tags) ? tags : tags.split(',');
            const allExpenses = await this.expenseService.getExpenses();
            const expenses = allExpenses.data?.expenses || [];
            
            const filteredExpenses = expenses.filter(expense => {
                return expense.tags && tagArray.some(tag => 
                    expense.tags.includes(tag.trim())
                );
            });
            
            res.json({
                success: true,
                data: {
                    tags: tagArray,
                    count: filteredExpenses.length,
                    expenses: filteredExpenses
                }
            });
            
        } catch (error) {
            console.error('❌ Error en getExpensesByTags:', error.message);
            res.status(500).json({
                success: false,
                error: 'Error interno del servidor'
            });
        }
    }

    /**
     * 📋 Obtener gastos pendientes de aprobación
     */
    async getPendingApprovals(req, res) {
        try {
            const { approverRole } = req.query;
            
            const allExpenses = await this.expenseService.getExpenses({
                status: 'pending_approval'
            });
            
            let pendingExpenses = allExpenses.data?.expenses || [];
            
            // Filtrar por rol del aprobador si se especifica
            if (approverRole) {
                pendingExpenses = pendingExpenses.filter(expense => 
                    expense.approvers && expense.approvers.includes(approverRole)
                );
            }
            
            // Enriquecer con información de prioridad
            const enrichedExpenses = pendingExpenses.map(expense => ({
                ...expense,
                priority: this.calculateApprovalPriority(expense),
                daysPending: Math.floor(
                    (new Date() - new Date(expense.createdAt)) / (1000 * 60 * 60 * 24)
                )
            }));
            
            // Ordenar por prioridad
            enrichedExpenses.sort((a, b) => {
                const priorityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
                return priorityOrder[b.priority] - priorityOrder[a.priority];
            });
            
            res.json({
                success: true,
                data: {
                    count: enrichedExpenses.length,
                    expenses: enrichedExpenses,
                    summary: {
                        totalAmount: enrichedExpenses.reduce((sum, exp) => sum + exp.amount, 0),
                        highPriority: enrichedExpenses.filter(e => e.priority === 'high').length,
                        overdue: enrichedExpenses.filter(e => e.daysPending > 3).length
                    }
                }
            });
            
        } catch (error) {
            console.error('❌ Error en getPendingApprovals:', error.message);
            res.status(500).json({
                success: false,
                error: 'Error interno del servidor'
            });
        }
    }

    /**
     * 💾 Actualizar gasto
     */
    async updateExpense(req, res) {
        try {
            const { expenseId } = req.params;
            const updateData = req.body;
            
            // Validar que el gasto existe
            const expense = await this.expenseService.getExpenseById(expenseId);
            if (!expense) {
                return res.status(404).json({
                    success: false,
                    error: 'Gasto no encontrado'
                });
            }
            
            // Validar que se puede actualizar
            if (expense.status === 'paid') {
                return res.status(400).json({
                    success: false,
                    error: 'No se puede actualizar un gasto ya pagado'
                });
            }
            
            // Actualizar campos permitidos
            const allowedFields = ['description', 'amount', 'category', 'subcategory', 
                                 'vendor', 'notes', 'tags', 'dueDate'];
            
            let updated = false;
            allowedFields.forEach(field => {
                if (updateData.hasOwnProperty(field)) {
                    expense[field] = updateData[field];
                    updated = true;
                }
            });
            
            if (!updated) {
                return res.status(400).json({
                    success: false,
                    error: 'No hay campos válidos para actualizar'
                });
            }
            
            // Recalcular nivel de aprobación si cambió el monto
            if (updateData.amount) {
                const newLevel = this.expenseService.getApprovalLevel(parseFloat(updateData.amount));
                if (newLevel !== expense.approvalLevel) {
                    expense.approvalLevel = newLevel;
                    expense.approvers = this.expenseService.getRequiredApprovers(newLevel);
                    expense.status = this.expenseService.determineInitialStatus(parseFloat(updateData.amount));
                    expense.approvalHistory = []; // Reset approval history
                }
            }
            
            expense.updatedAt = new Date();
            
            // Guardar cambios
            await this.expenseService.saveExpense(expense);
            
            res.json({
                success: true,
                message: 'Gasto actualizado exitosamente',
                data: expense
            });
            
        } catch (error) {
            console.error('❌ Error en updateExpense:', error.message);
            res.status(500).json({
                success: false,
                error: 'Error interno del servidor'
            });
        }
    }

    /**
     * 🔧 Funciones de utilidad
     */
    generateMonthlyTrend(expenses) {
        const monthlyData = {};
        
        expenses.forEach(expense => {
            const month = new Date(expense.createdAt).toISOString().slice(0, 7);
            if (!monthlyData[month]) {
                monthlyData[month] = { count: 0, amount: 0 };
            }
            monthlyData[month].count++;
            monthlyData[month].amount += expense.amount;
        });
        
        return Object.entries(monthlyData)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([month, data]) => ({
                month,
                count: data.count,
                amount: data.amount,
                average: data.count > 0 ? data.amount / data.count : 0
            }));
    }
    
    calculateApprovalPriority(expense) {
        const daysOld = Math.floor(
            (new Date() - new Date(expense.createdAt)) / (1000 * 60 * 60 * 24)
        );
        
        if (expense.amount > 5000 || daysOld > 3) return 'high';
        if (expense.amount > 1000 || daysOld > 1) return 'medium';
        return 'low';
    }

    /**
     * 🗑️ Eliminar gasto (solo si está en estado draft o rejected)
     */
    async deleteExpense(req, res) {
        try {
            const { expenseId } = req.params;
            const { reason } = req.body;
            
            const expense = await this.expenseService.getExpenseById(expenseId);
            if (!expense) {
                return res.status(404).json({
                    success: false,
                    error: 'Gasto no encontrado'
                });
            }
            
            // Solo permitir eliminación de gastos rechazados o en borrador
            if (!['rejected', 'draft'].includes(expense.status)) {
                return res.status(400).json({
                    success: false,
                    error: 'Solo se pueden eliminar gastos rechazados o en borrador'
                });
            }
            
            // Marcar como eliminado en lugar de eliminar físicamente
            expense.status = 'deleted';
            expense.deletedAt = new Date();
            expense.deletionReason = reason || 'Sin razón especificada';
            expense.updatedAt = new Date();
            
            await this.expenseService.saveExpense(expense);
            
            res.json({
                success: true,
                message: 'Gasto eliminado exitosamente'
            });
            
        } catch (error) {
            console.error('❌ Error en deleteExpense:', error.message);
            res.status(500).json({
                success: false,
                error: 'Error interno del servidor'
            });
        }
    }
}

module.exports = ExpenseController;
