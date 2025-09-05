/**
 * Sistema de Gestión de Gastos - POS ConEJO NEGRO
 * 💼 Feature: Sistema completo de gestión de gastos
 * 💰 TaskMaster: Advanced Expense Management System
 */

const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs').promises;

class ExpenseManagementService {
    constructor() {
        this.expensesPath = path.join(__dirname, '..', '..', 'data', 'expenses');
        this.categoriesPath = path.join(__dirname, '..', '..', 'data', 'expense-categories.json');
        
        // Categorías predefinidas de gastos
        this.defaultCategories = {
            'operational': {
                name: 'Gastos Operativos',
                icon: '🔧',
                subcategories: ['Mantenimiento', 'Reparaciones', 'Servicios técnicos'],
                budgetAlert: 5000,
                taxDeductible: true
            },
            'supplies': {
                name: 'Suministros',
                icon: '📦',
                subcategories: ['Oficina', 'Limpieza', 'Empaques', 'Inventario'],
                budgetAlert: 3000,
                taxDeductible: true
            },
            'services': {
                name: 'Servicios',
                icon: '⚡',
                subcategories: ['Electricidad', 'Agua', 'Internet', 'Teléfono', 'Gas'],
                budgetAlert: 2000,
                taxDeductible: true
            },
            'marketing': {
                name: 'Marketing y Publicidad',
                icon: '📢',
                subcategories: ['Publicidad digital', 'Promocionales', 'Eventos', 'Diseño'],
                budgetAlert: 4000,
                taxDeductible: true
            },
            'transportation': {
                name: 'Transporte',
                icon: '🚚',
                subcategories: ['Combustible', 'Mantenimiento vehículos', 'Envíos'],
                budgetAlert: 1500,
                taxDeductible: true
            },
            'personnel': {
                name: 'Personal',
                icon: '👥',
                subcategories: ['Capacitación', 'Uniformes', 'Bonificaciones'],
                budgetAlert: 8000,
                taxDeductible: false
            },
            'administrative': {
                name: 'Administrativos',
                icon: '📋',
                subcategories: ['Contabilidad', 'Legal', 'Seguros', 'Licencias'],
                budgetAlert: 3500,
                taxDeductible: true
            },
            'miscellaneous': {
                name: 'Varios',
                icon: '📝',
                subcategories: ['Otros gastos'],
                budgetAlert: 1000,
                taxDeductible: false
            }
        };

        this.approvalWorkflow = {
            'low': { limit: 500, requiresApproval: false, approvers: [] },
            'medium': { limit: 2000, requiresApproval: true, approvers: ['supervisor'] },
            'high': { limit: 10000, requiresApproval: true, approvers: ['supervisor', 'manager'] },
            'critical': { limit: Infinity, requiresApproval: true, approvers: ['supervisor', 'manager', 'director'] }
        };

        this.initializeService();
        console.log('💼 TaskMaster: Sistema de Gestión de Gastos Inicializado');
    }

    /**
     * 🚀 Inicializar servicio
     */
    async initializeService() {
        try {
            await this.createDirectories();
            await this.loadOrCreateCategories();
            console.log('✅ Expense Management Service inicializado correctamente');
        } catch (error) {
            console.error('❌ Error inicializando Expense Service:', error.message);
        }
    }

    /**
     * 📁 Crear directorios necesarios
     */
    async createDirectories() {
        try {
            await fs.mkdir(this.expensesPath, { recursive: true });
            await fs.mkdir(path.dirname(this.categoriesPath), { recursive: true });
        } catch (error) {
            if (error.code !== 'EEXIST') throw error;
        }
    }

    /**
     * 📋 Cargar o crear categorías
     */
    async loadOrCreateCategories() {
        try {
            const data = await fs.readFile(this.categoriesPath, 'utf8');
            this.categories = JSON.parse(data);
        } catch (error) {
            console.log('📋 Creando categorías por defecto...');
            this.categories = this.defaultCategories;
            await this.saveCategories();
        }
    }

    /**
     * 💾 Guardar categorías
     */
    async saveCategories() {
        await fs.writeFile(this.categoriesPath, JSON.stringify(this.categories, null, 2));
    }

    /**
     * 💰 Crear nuevo gasto
     */
    async createExpense(expenseData) {
        try {
            const { 
                description, 
                amount, 
                category, 
                subcategory,
                vendor,
                paymentMethod,
                receiptUrl,
                dueDate,
                requestedBy,
                notes,
                tags = []
            } = expenseData;

            // Validar datos
            const validation = this.validateExpenseData(expenseData);
            if (!validation.valid) {
                throw new Error(`Datos inválidos: ${validation.errors.join(', ')}`);
            }

            const expense = {
                id: uuidv4(),
                description,
                amount: parseFloat(amount),
                category,
                subcategory,
                vendor: vendor || 'N/A',
                paymentMethod: paymentMethod || 'cash',
                receiptUrl,
                dueDate: dueDate ? new Date(dueDate) : null,
                requestedBy,
                notes: notes || '',
                tags: Array.isArray(tags) ? tags : [],
                
                // Metadata del sistema
                createdAt: new Date(),
                updatedAt: new Date(),
                status: this.determineInitialStatus(amount),
                approvalLevel: this.getApprovalLevel(amount),
                approvers: [],
                approvalHistory: [],
                
                // Campos financieros
                taxDeductible: this.categories[category]?.taxDeductible || false,
                fiscalYear: new Date().getFullYear(),
                fiscalMonth: new Date().getMonth() + 1,
                
                // Campos de seguimiento
                paidAt: null,
                paidBy: null,
                paymentReference: null,
                attachments: receiptUrl ? [receiptUrl] : []
            };

            // Asignar aprobadores si es necesario
            if (expense.status === 'pending_approval') {
                expense.approvers = this.getRequiredApprovers(expense.approvalLevel);
            }

            // Guardar en archivo
            await this.saveExpense(expense);

            // Verificar alertas de presupuesto
            await this.checkBudgetAlerts(expense);

            // Reportar al supervisor
            await this.reportToSupervisor('EXPENSE_CREATED', {
                expenseId: expense.id,
                amount: expense.amount,
                category: expense.category,
                status: expense.status
            });

            console.log(`💰 Gasto creado: ${expense.id} - $${expense.amount}`);

            return {
                success: true,
                data: expense,
                message: 'Gasto creado exitosamente'
            };

        } catch (error) {
            console.error('❌ Error creando gasto:', error.message);
            await this.reportToSupervisor('EXPENSE_CREATION_ERROR', { error: error.message });
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * ✅ Aprobar gasto
     */
    async approveExpense(expenseId, approverData) {
        try {
            const { approverId, approverRole, notes } = approverData;
            
            const expense = await this.getExpenseById(expenseId);
            if (!expense) {
                throw new Error('Gasto no encontrado');
            }

            if (expense.status !== 'pending_approval') {
                throw new Error('El gasto no está pendiente de aprobación');
            }

            // Verificar si el aprobador tiene permisos
            if (!this.canApprove(approverRole, expense.approvalLevel)) {
                throw new Error('Sin permisos para aprobar este gasto');
            }

            // Registrar aprobación
            const approval = {
                approverId,
                approverRole,
                approvedAt: new Date(),
                notes: notes || '',
                action: 'approved'
            };

            expense.approvalHistory.push(approval);

            // Remover de la lista de aprobadores pendientes
            expense.approvers = expense.approvers.filter(role => role !== approverRole);

            // Verificar si todas las aprobaciones están completas
            if (expense.approvers.length === 0) {
                expense.status = 'approved';
                expense.approvedAt = new Date();
            }

            expense.updatedAt = new Date();

            await this.saveExpense(expense);

            // Reportar al supervisor
            await this.reportToSupervisor('EXPENSE_APPROVED', {
                expenseId: expense.id,
                approverId,
                finalStatus: expense.status
            });

            console.log(`✅ Gasto aprobado: ${expenseId} por ${approverRole}`);

            return {
                success: true,
                data: expense,
                message: 'Gasto aprobado exitosamente'
            };

        } catch (error) {
            console.error('❌ Error aprobando gasto:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * ❌ Rechazar gasto
     */
    async rejectExpense(expenseId, rejectorData) {
        try {
            const { rejectorId, rejectorRole, reason } = rejectorData;
            
            const expense = await this.getExpenseById(expenseId);
            if (!expense) {
                throw new Error('Gasto no encontrado');
            }

            const rejection = {
                rejectorId,
                rejectorRole,
                rejectedAt: new Date(),
                reason: reason || 'Sin razón especificada',
                action: 'rejected'
            };

            expense.approvalHistory.push(rejection);
            expense.status = 'rejected';
            expense.updatedAt = new Date();

            await this.saveExpense(expense);

            // Reportar al supervisor
            await this.reportToSupervisor('EXPENSE_REJECTED', {
                expenseId: expense.id,
                rejectorId,
                reason
            });

            console.log(`❌ Gasto rechazado: ${expenseId} por ${rejectorRole}`);

            return {
                success: true,
                data: expense,
                message: 'Gasto rechazado'
            };

        } catch (error) {
            console.error('❌ Error rechazando gasto:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * 💳 Marcar gasto como pagado
     */
    async markAsPaid(expenseId, paymentData) {
        try {
            const { paidBy, paymentReference, paymentDate } = paymentData;
            
            const expense = await this.getExpenseById(expenseId);
            if (!expense) {
                throw new Error('Gasto no encontrado');
            }

            if (expense.status !== 'approved') {
                throw new Error('El gasto debe estar aprobado para marcarse como pagado');
            }

            expense.status = 'paid';
            expense.paidAt = paymentDate ? new Date(paymentDate) : new Date();
            expense.paidBy = paidBy;
            expense.paymentReference = paymentReference;
            expense.updatedAt = new Date();

            await this.saveExpense(expense);

            // Actualizar métricas de gastos
            await this.updateExpenseMetrics(expense);

            console.log(`💳 Gasto pagado: ${expenseId} - $${expense.amount}`);

            return {
                success: true,
                data: expense,
                message: 'Gasto marcado como pagado'
            };

        } catch (error) {
            console.error('❌ Error marcando como pagado:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * 🔍 Obtener gastos con filtros
     */
    async getExpenses(filters = {}) {
        try {
            const { 
                category, 
                status, 
                dateFrom, 
                dateTo, 
                minAmount, 
                maxAmount,
                requestedBy,
                page = 1,
                limit = 20,
                sortBy = 'createdAt',
                sortOrder = 'desc'
            } = filters;

            const files = await fs.readdir(this.expensesPath);
            const expenses = [];

            for (const file of files) {
                if (file.endsWith('.json')) {
                    try {
                        const data = await fs.readFile(path.join(this.expensesPath, file), 'utf8');
                        const expense = JSON.parse(data);
                        expenses.push(expense);
                    } catch (error) {
                        console.warn('⚠️ Error leyendo archivo de gasto:', file);
                    }
                }
            }

            // Aplicar filtros
            let filteredExpenses = expenses.filter(expense => {
                if (category && expense.category !== category) return false;
                if (status && expense.status !== status) return false;
                if (requestedBy && expense.requestedBy !== requestedBy) return false;
                
                if (dateFrom && new Date(expense.createdAt) < new Date(dateFrom)) return false;
                if (dateTo && new Date(expense.createdAt) > new Date(dateTo)) return false;
                
                if (minAmount && expense.amount < minAmount) return false;
                if (maxAmount && expense.amount > maxAmount) return false;
                
                return true;
            });

            // Ordenar
            filteredExpenses.sort((a, b) => {
                const aVal = sortBy === 'createdAt' ? new Date(a[sortBy]) : a[sortBy];
                const bVal = sortBy === 'createdAt' ? new Date(b[sortBy]) : b[sortBy];
                
                if (sortOrder === 'desc') {
                    return aVal < bVal ? 1 : -1;
                }
                return aVal > bVal ? 1 : -1;
            });

            // Paginación
            const total = filteredExpenses.length;
            const offset = (page - 1) * limit;
            const paginatedExpenses = filteredExpenses.slice(offset, offset + limit);

            return {
                success: true,
                data: {
                    expenses: paginatedExpenses,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total,
                        totalPages: Math.ceil(total / limit)
                    },
                    summary: {
                        totalAmount: filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0),
                        averageAmount: total > 0 ? filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0) / total : 0,
                        statusBreakdown: this.getStatusBreakdown(filteredExpenses),
                        categoryBreakdown: this.getCategoryBreakdown(filteredExpenses)
                    }
                }
            };

        } catch (error) {
            console.error('❌ Error obteniendo gastos:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * 📊 Generar reporte de gastos
     */
    async generateExpenseReport(reportType, period) {
        try {
            const reportId = uuidv4();
            console.log(`📊 Generando reporte ${reportType} para período ${period}...`);

            const expenses = await this.getExpensesForPeriod(period);
            
            const report = {
                id: reportId,
                type: reportType,
                period: period,
                generatedAt: new Date(),
                
                summary: {
                    totalExpenses: expenses.length,
                    totalAmount: expenses.reduce((sum, exp) => sum + exp.amount, 0),
                    averageExpense: expenses.length > 0 ? 
                        expenses.reduce((sum, exp) => sum + exp.amount, 0) / expenses.length : 0,
                    
                    byStatus: this.getStatusBreakdown(expenses),
                    byCategory: this.getCategoryBreakdown(expenses),
                    byMonth: this.getMonthlyBreakdown(expenses),
                    topVendors: this.getTopVendors(expenses, 10),
                    
                    approvalMetrics: {
                        avgApprovalTime: this.calculateAvgApprovalTime(expenses),
                        pendingApprovals: expenses.filter(e => e.status === 'pending_approval').length,
                        rejectionRate: this.calculateRejectionRate(expenses)
                    },
                    
                    budgetAnalysis: await this.generateBudgetAnalysis(expenses),
                    taxAnalysis: this.generateTaxAnalysis(expenses)
                },
                
                details: reportType === 'detailed' ? expenses : null,
                recommendations: await this.generateRecommendations(expenses)
            };

            // Guardar reporte
            const reportPath = path.join(this.expensesPath, `report_${reportId}.json`);
            await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

            // Reportar al supervisor
            await this.reportToSupervisor('EXPENSE_REPORT_GENERATED', {
                reportId,
                reportType,
                period,
                totalExpenses: report.summary.totalExpenses,
                totalAmount: report.summary.totalAmount
            });

            console.log(`📊 Reporte generado: ${reportId}`);

            return {
                success: true,
                data: report,
                message: 'Reporte generado exitosamente'
            };

        } catch (error) {
            console.error('❌ Error generando reporte:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * 📈 Obtener dashboard de gastos
     */
    async getExpenseDashboard() {
        try {
            const currentMonth = new Date();
            const expenses = await this.getExpensesForPeriod('current_month');
            
            const dashboard = {
                currentMonth: {
                    total: expenses.reduce((sum, exp) => sum + exp.amount, 0),
                    count: expenses.length,
                    approved: expenses.filter(e => e.status === 'approved').length,
                    pending: expenses.filter(e => e.status === 'pending_approval').length,
                    paid: expenses.filter(e => e.status === 'paid').length
                },
                
                categories: Object.keys(this.categories).map(key => ({
                    id: key,
                    name: this.categories[key].name,
                    icon: this.categories[key].icon,
                    currentSpend: expenses
                        .filter(e => e.category === key)
                        .reduce((sum, exp) => sum + exp.amount, 0),
                    budgetAlert: this.categories[key].budgetAlert,
                    alertTriggered: expenses
                        .filter(e => e.category === key)
                        .reduce((sum, exp) => sum + exp.amount, 0) > this.categories[key].budgetAlert
                })),
                
                recentExpenses: expenses
                    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                    .slice(0, 10),
                    
                pendingApprovals: expenses.filter(e => e.status === 'pending_approval'),
                
                trends: await this.calculateTrends(),
                
                alerts: await this.generateAlerts(expenses)
            };

            return {
                success: true,
                data: dashboard
            };

        } catch (error) {
            console.error('❌ Error obteniendo dashboard:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * 🔧 Funciones de utilidad
     */
    validateExpenseData(data) {
        const errors = [];
        
        if (!data.description || data.description.trim().length === 0) {
            errors.push('Descripción es requerida');
        }
        
        if (!data.amount || isNaN(data.amount) || data.amount <= 0) {
            errors.push('Monto debe ser un número positivo');
        }
        
        if (!data.category || !this.categories[data.category]) {
            errors.push('Categoría inválida');
        }
        
        if (!data.requestedBy) {
            errors.push('Usuario solicitante es requerido');
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    }

    determineInitialStatus(amount) {
        const level = this.getApprovalLevel(amount);
        return this.approvalWorkflow[level].requiresApproval ? 'pending_approval' : 'approved';
    }

    getApprovalLevel(amount) {
        if (amount <= this.approvalWorkflow.low.limit) return 'low';
        if (amount <= this.approvalWorkflow.medium.limit) return 'medium';
        if (amount <= this.approvalWorkflow.high.limit) return 'high';
        return 'critical';
    }

    getRequiredApprovers(level) {
        return [...this.approvalWorkflow[level].approvers];
    }

    canApprove(role, level) {
        return this.approvalWorkflow[level].approvers.includes(role);
    }

    async saveExpense(expense) {
        const filePath = path.join(this.expensesPath, `${expense.id}.json`);
        await fs.writeFile(filePath, JSON.stringify(expense, null, 2));
    }

    async getExpenseById(id) {
        try {
            const filePath = path.join(this.expensesPath, `${id}.json`);
            const data = await fs.readFile(filePath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            return null;
        }
    }

    async getExpensesForPeriod(period) {
        // Implementación simplificada
        const expenses = await this.getExpenses();
        return expenses.data?.expenses || [];
    }

    getStatusBreakdown(expenses) {
        return expenses.reduce((acc, exp) => {
            acc[exp.status] = (acc[exp.status] || 0) + 1;
            return acc;
        }, {});
    }

    getCategoryBreakdown(expenses) {
        return expenses.reduce((acc, exp) => {
            acc[exp.category] = (acc[exp.category] || 0) + exp.amount;
            return acc;
        }, {});
    }

    getMonthlyBreakdown(expenses) {
        return expenses.reduce((acc, exp) => {
            const month = new Date(exp.createdAt).toISOString().slice(0, 7);
            acc[month] = (acc[month] || 0) + exp.amount;
            return acc;
        }, {});
    }

    getTopVendors(expenses, limit) {
        const vendors = expenses.reduce((acc, exp) => {
            acc[exp.vendor] = (acc[exp.vendor] || 0) + exp.amount;
            return acc;
        }, {});
        
        return Object.entries(vendors)
            .sort(([,a], [,b]) => b - a)
            .slice(0, limit)
            .map(([vendor, amount]) => ({ vendor, amount }));
    }

    async checkBudgetAlerts(expense) {
        const category = this.categories[expense.category];
        if (category?.budgetAlert && expense.amount > category.budgetAlert) {
            await this.reportToSupervisor('BUDGET_ALERT', {
                category: expense.category,
                amount: expense.amount,
                budgetAlert: category.budgetAlert
            });
        }
    }

    async updateExpenseMetrics(expense) {
        // Actualizar métricas del sistema
    }

    calculateAvgApprovalTime(expenses) {
        const approvedExpenses = expenses.filter(e => e.status === 'approved' || e.status === 'paid');
        if (approvedExpenses.length === 0) return 0;
        
        const totalTime = approvedExpenses.reduce((sum, exp) => {
            if (exp.approvedAt) {
                return sum + (new Date(exp.approvedAt) - new Date(exp.createdAt));
            }
            return sum;
        }, 0);
        
        return Math.round(totalTime / approvedExpenses.length / (1000 * 60 * 60)); // horas
    }

    calculateRejectionRate(expenses) {
        if (expenses.length === 0) return 0;
        const rejected = expenses.filter(e => e.status === 'rejected').length;
        return ((rejected / expenses.length) * 100).toFixed(2);
    }

    async generateBudgetAnalysis(expenses) {
        return {
            totalBudget: 50000, // Simulado
            spent: expenses.reduce((sum, exp) => sum + exp.amount, 0),
            remaining: 50000 - expenses.reduce((sum, exp) => sum + exp.amount, 0),
            utilizationRate: ((expenses.reduce((sum, exp) => sum + exp.amount, 0) / 50000) * 100).toFixed(2)
        };
    }

    generateTaxAnalysis(expenses) {
        const deductible = expenses.filter(e => e.taxDeductible).reduce((sum, exp) => sum + exp.amount, 0);
        const nonDeductible = expenses.filter(e => !e.taxDeductible).reduce((sum, exp) => sum + exp.amount, 0);
        
        return {
            deductible,
            nonDeductible,
            totalTaxSavings: deductible * 0.30 // Estimado 30%
        };
    }

    async generateRecommendations(expenses) {
        const recommendations = [];
        
        // Análisis de patrones de gastos
        const categorySpend = this.getCategoryBreakdown(expenses);
        const topCategory = Object.entries(categorySpend).sort(([,a], [,b]) => b - a)[0];
        
        if (topCategory && topCategory[1] > 10000) {
            recommendations.push({
                type: 'cost_optimization',
                priority: 'medium',
                message: `Categoría ${topCategory[0]} representa el mayor gasto. Revisar proveedores.`
            });
        }
        
        return recommendations;
    }

    async calculateTrends() {
        // Simulación de tendencias
        return {
            monthlyGrowth: '12.5%',
            categoryTrends: {
                operational: '+5%',
                supplies: '-2%',
                services: '+8%'
            }
        };
    }

    async generateAlerts(expenses) {
        const alerts = [];
        
        const pendingCount = expenses.filter(e => e.status === 'pending_approval').length;
        if (pendingCount > 5) {
            alerts.push({
                type: 'approval_backlog',
                severity: 'warning',
                message: `${pendingCount} gastos pendientes de aprobación`
            });
        }
        
        return alerts;
    }

    async reportToSupervisor(event, data) {
        try {
            const reportData = {
                source: 'expense-management-service',
                event: event,
                data: data,
                timestamp: new Date().toISOString()
            };

            const response = await fetch('http://localhost:3001/agent-report', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Agent-ID': 'task-master-expense-manager'
                },
                body: JSON.stringify(reportData)
            });

            if (response.ok) {
                console.log(`📡 Evento reportado: ${event}`);
            }
        } catch (error) {
            console.warn('⚠️ No se pudo reportar al supervisor:', error.message);
        }
    }
}

module.exports = ExpenseManagementService;
