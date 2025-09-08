/**
 * MÓDULO DE GASTOS INTEGRADO
 * Maneja la funcionalidad completa del módulo de gastos
 */

// Namespace global para el módulo de gastos
window.Expenses = (() => {
    let initialized = false;
    let expenses = [];
    let categories = {};
    let isLoading = false;

    // API Base URL
    const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
        ? 'http://localhost:3000/api' 
        : `${window.location.protocol}//${window.location.host}/api`;

    /**
     * Inicializar el módulo de gastos
     */
    function init() {
        if (initialized) return;
        console.log('🧾 Inicializando módulo de gastos...');
        
        bindEvents();
        loadInitialData();
        initialized = true;
        
        console.log('✅ Módulo de gastos inicializado');
    }

    /**
     * Vincular eventos del módulo
     */
    function bindEvents() {
        const root = document.getElementById('expenses-root');
        if (!root) return;

        // Event delegation para botones
        root.addEventListener('click', handleButtonClick);
        root.addEventListener('change', handleFilterChange);
    }

    /**
     * Manejar clics en botones
     */
    function handleButtonClick(e) {
        const target = e.target.closest('button');
        if (!target) return;

        const action = target.id;
        switch (action) {
            case 'expenses-add-btn':
                openExpenseModal();
                break;
            case 'expenses-report-btn':
                openExpenseReport();
                break;
            default:
                if (target.classList.contains('btn-edit')) {
                    editExpense(target.dataset.expenseId);
                } else if (target.classList.contains('btn-danger')) {
                    deleteExpense(target.dataset.expenseId);
                }
        }
    }

    /**
     * Manejar cambios en filtros
     */
    function handleFilterChange(e) {
        const target = e.target;
        if (target.id.startsWith('expenses-filtro') || target.id.startsWith('expenses-fecha')) {
            filterExpenses();
        }
    }

    /**
     * Cargar datos iniciales
     */
    async function loadInitialData() {
        showLoading(true);
        try {
            await Promise.all([
                loadCategories(),
                loadExpenses()
            ]);
        } catch (error) {
            console.error('Error cargando datos iniciales:', error);
            showNotification('Error cargando datos de gastos', 'error');
        } finally {
            showLoading(false);
        }
    }

    /**
     * Cargar categorías de gastos
     */
    async function loadCategories() {
        try {
            const response = await fetch(`${API_BASE}/expense-categories`, {
                credentials: 'include'
            });
            
            if (response.ok) {
                categories = await response.json();
                updateCategoryFilters();
                console.log('✅ Categorías cargadas:', Object.keys(categories).length);
            } else {
                console.warn('No se pudieron cargar las categorías');
                // Usar categorías por defecto
                categories = {
                    'operacional': { name: 'Operacional', icon: 'cogs' },
                    'marketing': { name: 'Marketing', icon: 'bullhorn' },
                    'mantenimiento': { name: 'Mantenimiento', icon: 'wrench' },
                    'servicios': { name: 'Servicios', icon: 'handshake' },
                    'otros': { name: 'Otros', icon: 'ellipsis-h' }
                };
                updateCategoryFilters();
            }
        } catch (error) {
            console.error('Error cargando categorías:', error);
        }
    }

    /**
     * Cargar lista de gastos
     */
    async function loadExpenses() {
        try {
            const response = await fetch(`${API_BASE}/expenses`, {
                credentials: 'include'
            });
            
            if (response.ok) {
                expenses = await response.json();
                renderExpenses();
                updateStats();
                console.log('✅ Gastos cargados:', expenses.length);
            } else {
                console.warn('No se pudieron cargar los gastos');
                expenses = [];
                renderExpenses();
            }
        } catch (error) {
            console.error('Error cargando gastos:', error);
            expenses = [];
            renderExpenses();
        }
    }

    /**
     * Renderizar gastos en el grid
     */
    function renderExpenses(filteredExpenses = null) {
        const grid = document.getElementById('expenses-grid');
        if (!grid) return;

        const expensesToRender = filteredExpenses || expenses;
        
        if (expensesToRender.length === 0) {
            grid.innerHTML = `
                <div class="expenses-empty-state">
                    <i class="fas fa-receipt"></i>
                    <h3>No hay gastos registrados</h3>
                    <p>Comienza agregando tu primer gasto</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = expensesToRender.map(expense => createExpenseCard(expense)).join('');
    }

    /**
     * Crear tarjeta de gasto
     */
    function createExpenseCard(expense) {
        const categoryInfo = categories[expense.category] || { name: expense.category, icon: 'receipt' };
        const formattedDate = new Date(expense.date).toLocaleDateString('es-ES');
        const statusClass = expense.status || 'pagado';

        return `
            <div class="expense-card">
                <div class="expense-header">
                    <div class="expense-amount">$${expense.amount.toLocaleString()}</div>
                    <div class="expense-status ${statusClass}">${statusClass}</div>
                </div>
                
                <div class="expense-category">
                    <i class="fas fa-${categoryInfo.icon}"></i>
                    ${categoryInfo.name}
                </div>
                
                <div class="expense-description">${expense.description}</div>
                
                <div class="expense-meta">
                    <div><i class="fas fa-calendar"></i> ${formattedDate}</div>
                    <div><i class="fas fa-credit-card"></i> ${expense.paymentMethod || 'efectivo'}</div>
                    ${expense.supplier ? `<div><i class="fas fa-store"></i> ${expense.supplier}</div>` : ''}
                    ${expense.invoiceNumber ? `<div><i class="fas fa-file-invoice"></i> ${expense.invoiceNumber}</div>` : ''}
                </div>
                
                <div class="expense-actions">
                    <button class="btn btn-edit" data-expense-id="${expense.id || expense._id}">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                    <button class="btn btn-danger" data-expense-id="${expense.id || expense._id}">
                        <i class="fas fa-trash"></i> Eliminar
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Actualizar estadísticas rápidas
     */
    function updateStats() {
        // Gastos de este mes
        const today = new Date();
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const monthExpenses = expenses.filter(e => new Date(e.date) >= startOfMonth);
        const monthTotal = monthExpenses.reduce((sum, e) => sum + e.amount, 0);
        
        // Gastos pendientes
        const pending = expenses.filter(e => e.status === 'pendiente').length;
        
        // Categoría con mayor gasto
        const expensesByCategory = {};
        expenses.forEach(e => {
            expensesByCategory[e.category] = (expensesByCategory[e.category] || 0) + e.amount;
        });
        
        let topCategory = '-';
        let topAmount = 0;
        Object.entries(expensesByCategory).forEach(([cat, amount]) => {
            if (amount > topAmount) {
                topAmount = amount;
                topCategory = categories[cat]?.name || cat;
            }
        });

        // Actualizar DOM
        updateStatElement('expenses-gastos-mes', `$${monthTotal.toLocaleString()}`);
        updateStatElement('expenses-gastos-pendientes', pending.toString());
        updateStatElement('expenses-categoria-mayor', topCategory);
        updateStatElement('expenses-balance-neto', `-$${monthTotal.toLocaleString()}`);
    }

    /**
     * Actualizar elemento de estadística
     */
    function updateStatElement(id, value) {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
    }

    /**
     * Actualizar filtros de categorías
     */
    function updateCategoryFilters() {
        const categorySelect = document.getElementById('expenses-filtro-categoria');
        if (!categorySelect) return;

        categorySelect.innerHTML = '<option value="">Todas las categorías</option>' +
            Object.entries(categories).map(([key, cat]) => 
                `<option value="${key}">${cat.name}</option>`
            ).join('');
    }

    /**
     * Filtrar gastos
     */
    function filterExpenses() {
        const categoryFilter = document.getElementById('expenses-filtro-categoria')?.value;
        const statusFilter = document.getElementById('expenses-filtro-estado')?.value;
        const dateFromFilter = document.getElementById('expenses-fecha-desde')?.value;
        const dateToFilter = document.getElementById('expenses-fecha-hasta')?.value;

        let filtered = expenses.filter(expense => {
            // Filtro por categoría
            if (categoryFilter && expense.category !== categoryFilter) return false;
            
            // Filtro por estado
            if (statusFilter && expense.status !== statusFilter) return false;
            
            // Filtro por fecha
            const expenseDate = new Date(expense.date);
            if (dateFromFilter && expenseDate < new Date(dateFromFilter)) return false;
            if (dateToFilter && expenseDate > new Date(dateToFilter)) return false;
            
            return true;
        });

        renderExpenses(filtered);
    }

    /**
     * Abrir modal para agregar gasto
     */
    function openExpenseModal() {
        showNotification('Módulo de agregar gastos en desarrollo', 'info');
        // TODO: Implementar modal de agregar/editar gasto
    }

    /**
     * Abrir reporte de gastos
     */
    function openExpenseReport() {
        window.open(`${API_BASE}/expenses/financial-report`, '_blank');
    }

    /**
     * Editar gasto
     */
    function editExpense(expenseId) {
        showNotification(`Editar gasto ${expenseId} - Funcionalidad en desarrollo`, 'info');
        // TODO: Implementar edición de gasto
    }

    /**
     * Eliminar gasto
     */
    function deleteExpense(expenseId) {
        if (!confirm('¿Estás seguro de que deseas eliminar este gasto?')) return;
        
        showNotification(`Eliminar gasto ${expenseId} - Funcionalidad en desarrollo`, 'info');
        // TODO: Implementar eliminación de gasto
    }

    /**
     * Mostrar/ocultar loading
     */
    function showLoading(show) {
        const loading = document.getElementById('expenses-loading');
        if (loading) {
            loading.style.display = show ? 'block' : 'none';
        }
        isLoading = show;
    }

    /**
     * Mostrar notificación
     */
    function showNotification(message, type = 'info') {
        // Usar el sistema de notificaciones de la aplicación principal
        if (window.showNotification) {
            window.showNotification(message, type);
        } else {
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
    }

    /**
     * Hook: Al entrar a la sección de gastos
     */
    function onEnter() {
        console.log('🧾 Entrando a sección de gastos...');
        init();
        
        // Refrescar datos si ya estaba inicializado
        if (initialized) {
            loadInitialData();
        }
    }

    /**
     * Hook: Al salir de la sección de gastos
     */
    function onLeave() {
        console.log('🧾 Saliendo de sección de gastos...');
        // Limpiar timers si los hay
        // No limpiamos datos para mantener cache
    }

    /**
     * Refrescar datos
     */
    function refresh() {
        return loadInitialData();
    }

    // API pública del módulo
    return {
        onEnter,
        onLeave,
        init,
        refresh,
        // Métodos para testing o uso externo
        loadExpenses,
        loadCategories,
        filterExpenses
    };
})();

console.log('✅ Módulo Expenses cargado correctamente');
