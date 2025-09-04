/**
 * Expense Model - Sistema de Gestión de Gastos
 * POS Conejo Negro
 * 
 * Modelo para manejar todos los gastos del negocio:
 * - Gastos fijos (renta, servicios)
 * - Gastos variables (insumos, mantenimiento)
 * - Gastos de personal (sueldos, bonos)
 * - Gastos operativos (publicidad, software)
 */

class Expense {
    constructor(data = {}) {
        // Información básica del gasto
        this.id = data.id || this.generateId();
        this.amount = parseFloat(data.amount) || 0;
        this.description = data.description || '';
        this.category = data.category || 'otros';
        this.subcategory = data.subcategory || '';
        
        // Fechas y tiempo
        this.date = data.date ? new Date(data.date) : new Date();
        this.createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
        this.updatedAt = data.updatedAt ? new Date(data.updatedAt) : new Date();
        
        // Tipo de gasto
        this.type = data.type || 'unico'; // 'unico', 'recurrente'
        this.recurrenceFrequency = data.recurrenceFrequency || null; // 'mensual', 'semanal', 'anual'
        this.nextDueDate = data.nextDueDate ? new Date(data.nextDueDate) : null;
        
        // Información adicional
        this.supplier = data.supplier || ''; // Proveedor o empresa
        this.paymentMethod = data.paymentMethod || 'efectivo'; // efectivo, transferencia, tarjeta
        this.invoiceNumber = data.invoiceNumber || '';
        this.taxDeductible = data.taxDeductible || false;
        
        // Estado y control
        this.status = data.status || 'pagado'; // pagado, pendiente, vencido
        this.tags = Array.isArray(data.tags) ? data.tags : [];
        this.notes = data.notes || '';
        
        // Metadata
        this.createdBy = data.createdBy || 'system';
        this.isActive = data.isActive !== false;
    }

    generateId() {
        return 'expense_' + Math.random().toString(36).substr(2, 16) + Date.now().toString(36);
    }

    // Categorías predefinidas de gastos
    static getCategories() {
        return {
            'gastos-fijos': {
                name: 'Gastos Fijos',
                description: 'Gastos mensuales constantes',
                icon: 'fas fa-home',
                color: '#ff4757',
                subcategories: [
                    { id: 'renta', name: 'Renta del Local', typical_amount: 15000 },
                    { id: 'luz', name: 'Electricidad', typical_amount: 2000 },
                    { id: 'agua', name: 'Agua', typical_amount: 500 },
                    { id: 'internet', name: 'Internet', typical_amount: 800 },
                    { id: 'telefono', name: 'Teléfono', typical_amount: 400 },
                    { id: 'seguro', name: 'Seguros', typical_amount: 1500 },
                    { id: 'software', name: 'Software/Licencias', typical_amount: 1000 }
                ]
            },
            'sueldos': {
                name: 'Sueldos y Salarios',
                description: 'Pagos al personal',
                icon: 'fas fa-users',
                color: '#5352ed',
                subcategories: [
                    { id: 'sueldo-gerente', name: 'Sueldo Gerente', typical_amount: 20000 },
                    { id: 'sueldo-empleados', name: 'Sueldos Empleados', typical_amount: 12000 },
                    { id: 'bonos', name: 'Bonos y Comisiones', typical_amount: 2000 },
                    { id: 'prestaciones', name: 'Prestaciones Sociales', typical_amount: 3000 },
                    { id: 'capacitacion', name: 'Capacitación Personal', typical_amount: 1000 }
                ]
            },
            'insumos': {
                name: 'Insumos y Productos',
                description: 'Materias primas y productos para venta',
                icon: 'fas fa-boxes',
                color: '#00d2d3',
                subcategories: [
                    { id: 'cafe', name: 'Café (granos, molido)', typical_amount: 3000 },
                    { id: 'leche', name: 'Leche y Lácteos', typical_amount: 1500 },
                    { id: 'azucar', name: 'Azúcar y Endulzantes', typical_amount: 800 },
                    { id: 'vasos-desechables', name: 'Vasos Desechables', typical_amount: 1200 },
                    { id: 'servilletas', name: 'Servilletas y Papel', typical_amount: 600 },
                    { id: 'alimentos', name: 'Alimentos para Snacks', typical_amount: 2500 },
                    { id: 'limpieza', name: 'Productos de Limpieza', typical_amount: 800 }
                ]
            },
            'mantenimiento': {
                name: 'Mantenimiento',
                description: 'Reparaciones y mantenimiento',
                icon: 'fas fa-tools',
                color: '#ff9ff3',
                subcategories: [
                    { id: 'equipo-cafe', name: 'Mantenimiento Máquinas de Café', typical_amount: 1500 },
                    { id: 'mobiliario', name: 'Reparación Mobiliario', typical_amount: 800 },
                    { id: 'electrodomesticos', name: 'Electrodomésticos', typical_amount: 1000 },
                    { id: 'instalaciones', name: 'Instalaciones del Local', typical_amount: 2000 },
                    { id: 'limpieza-profunda', name: 'Limpieza Profunda', typical_amount: 1200 }
                ]
            },
            'marketing': {
                name: 'Marketing y Publicidad',
                description: 'Promoción y publicidad del negocio',
                icon: 'fas fa-bullhorn',
                color: '#54a0ff',
                subcategories: [
                    { id: 'redes-sociales', name: 'Publicidad Redes Sociales', typical_amount: 2000 },
                    { id: 'materiales', name: 'Materiales Promocionales', typical_amount: 1500 },
                    { id: 'eventos', name: 'Eventos y Activaciones', typical_amount: 3000 },
                    { id: 'diseño', name: 'Diseño Gráfico', typical_amount: 1000 }
                ]
            },
            'operativos': {
                name: 'Gastos Operativos',
                description: 'Gastos diversos de operación',
                icon: 'fas fa-cog',
                color: '#2ed573',
                subcategories: [
                    { id: 'transporte', name: 'Transporte y Combustible', typical_amount: 1000 },
                    { id: 'papeleria', name: 'Papelería y Oficina', typical_amount: 500 },
                    { id: 'contabilidad', name: 'Servicios Contables', typical_amount: 2000 },
                    { id: 'legal', name: 'Servicios Legales', typical_amount: 1500 },
                    { id: 'bancarios', name: 'Comisiones Bancarias', typical_amount: 400 }
                ]
            },
            'otros': {
                name: 'Otros Gastos',
                description: 'Gastos no clasificados',
                icon: 'fas fa-ellipsis-h',
                color: '#a4b0be',
                subcategories: [
                    { id: 'imprevistos', name: 'Gastos Imprevistos', typical_amount: 1000 },
                    { id: 'donaciones', name: 'Donaciones', typical_amount: 500 },
                    { id: 'multas', name: 'Multas y Recargos', typical_amount: 0 }
                ]
            }
        };
    }

    // Obtener información de categoría
    getCategoryInfo() {
        const categories = Expense.getCategories();
        return categories[this.category] || categories['otros'];
    }

    // Obtener información de subcategoría
    getSubcategoryInfo() {
        const categoryInfo = this.getCategoryInfo();
        if (!categoryInfo.subcategories) return null;
        
        return categoryInfo.subcategories.find(sub => sub.id === this.subcategory) || null;
    }

    // Validar datos del gasto
    validate() {
        const errors = [];
        
        if (!this.amount || this.amount <= 0) {
            errors.push('El monto debe ser mayor a 0');
        }
        
        if (!this.description || this.description.trim().length < 3) {
            errors.push('La descripción debe tener al menos 3 caracteres');
        }
        
        if (!this.category) {
            errors.push('La categoría es requerida');
        }
        
        const categories = Expense.getCategories();
        if (!categories[this.category]) {
            errors.push('Categoría no válida');
        }
        
        if (this.type === 'recurrente' && !this.recurrenceFrequency) {
            errors.push('Los gastos recurrentes requieren frecuencia');
        }
        
        if (this.amount > 1000000) {
            errors.push('El monto parece demasiado alto, verifique');
        }
        
        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    // Calcular próxima fecha de vencimiento para gastos recurrentes
    calculateNextDueDate() {
        if (this.type !== 'recurrente' || !this.recurrenceFrequency) {
            return null;
        }
        
        const baseDate = this.nextDueDate || this.date;
        const nextDate = new Date(baseDate);
        
        switch (this.recurrenceFrequency) {
            case 'semanal':
                nextDate.setDate(nextDate.getDate() + 7);
                break;
            case 'mensual':
                nextDate.setMonth(nextDate.getMonth() + 1);
                break;
            case 'trimestral':
                nextDate.setMonth(nextDate.getMonth() + 3);
                break;
            case 'semestral':
                nextDate.setMonth(nextDate.getMonth() + 6);
                break;
            case 'anual':
                nextDate.setFullYear(nextDate.getFullYear() + 1);
                break;
            default:
                return null;
        }
        
        return nextDate;
    }

    // Marcar como pagado
    markAsPaid() {
        this.status = 'pagado';
        this.updatedAt = new Date();
        
        // Si es recurrente, calcular próxima fecha
        if (this.type === 'recurrente') {
            this.nextDueDate = this.calculateNextDueDate();
        }
    }

    // Verificar si está vencido
    isOverdue() {
        if (this.status === 'pagado') return false;
        if (this.type !== 'recurrente') return false;
        if (!this.nextDueDate) return false;
        
        return new Date() > this.nextDueDate;
    }

    // Obtener resumen del gasto
    getSummary() {
        const categoryInfo = this.getCategoryInfo();
        const subcategoryInfo = this.getSubcategoryInfo();
        
        return {
            id: this.id,
            amount: this.amount,
            formattedAmount: `$${this.amount.toLocaleString()}`,
            description: this.description,
            category: categoryInfo.name,
            subcategory: subcategoryInfo ? subcategoryInfo.name : this.subcategory,
            date: this.date.toISOString().split('T')[0],
            formattedDate: this.date.toLocaleDateString('es-ES'),
            type: this.type,
            status: this.status,
            isRecurrent: this.type === 'recurrente',
            isOverdue: this.isOverdue(),
            categoryColor: categoryInfo.color,
            categoryIcon: categoryInfo.icon
        };
    }

    // Exportar a JSON
    toJSON() {
        return {
            id: this.id,
            amount: this.amount,
            description: this.description,
            category: this.category,
            subcategory: this.subcategory,
            date: this.date.toISOString(),
            createdAt: this.createdAt.toISOString(),
            updatedAt: this.updatedAt.toISOString(),
            type: this.type,
            recurrenceFrequency: this.recurrenceFrequency,
            nextDueDate: this.nextDueDate ? this.nextDueDate.toISOString() : null,
            supplier: this.supplier,
            paymentMethod: this.paymentMethod,
            invoiceNumber: this.invoiceNumber,
            taxDeductible: this.taxDeductible,
            status: this.status,
            tags: this.tags,
            notes: this.notes,
            createdBy: this.createdBy,
            isActive: this.isActive
        };
    }

    // Métodos estáticos para análisis

    // Obtener gastos por categoría
    static groupByCategory(expenses) {
        const grouped = {};
        
        expenses.forEach(expense => {
            if (!grouped[expense.category]) {
                grouped[expense.category] = {
                    category: expense.category,
                    categoryInfo: expense.getCategoryInfo(),
                    expenses: [],
                    totalAmount: 0,
                    count: 0
                };
            }
            
            grouped[expense.category].expenses.push(expense);
            grouped[expense.category].totalAmount += expense.amount;
            grouped[expense.category].count++;
        });
        
        return grouped;
    }

    // Calcular total de gastos en un período
    static calculatePeriodTotal(expenses, startDate, endDate) {
        return expenses
            .filter(expense => {
                const expenseDate = new Date(expense.date);
                return expenseDate >= startDate && expenseDate <= endDate;
            })
            .reduce((total, expense) => total + expense.amount, 0);
    }

    // Obtener gastos recurrentes pendientes
    static getOverdueRecurring(expenses) {
        return expenses.filter(expense => expense.isOverdue());
    }

    // Generar próximos gastos recurrentes
    static generateUpcomingRecurring(expenses, months = 3) {
        const upcoming = [];
        const cutoffDate = new Date();
        cutoffDate.setMonth(cutoffDate.getMonth() + months);
        
        expenses
            .filter(expense => expense.type === 'recurrente' && expense.isActive)
            .forEach(expense => {
                let nextDate = expense.nextDueDate || expense.calculateNextDueDate();
                
                while (nextDate && nextDate <= cutoffDate) {
                    upcoming.push({
                        ...expense.toJSON(),
                        id: expense.generateId(),
                        date: nextDate.toISOString(),
                        status: 'pendiente',
                        isProjected: true,
                        originalExpenseId: expense.id
                    });
                    
                    // Calcular siguiente fecha
                    const tempExpense = new Expense({ ...expense.toJSON(), nextDueDate: nextDate });
                    nextDate = tempExpense.calculateNextDueDate();
                }
            });
        
        return upcoming.sort((a, b) => new Date(a.date) - new Date(b.date));
    }
}

module.exports = Expense;
