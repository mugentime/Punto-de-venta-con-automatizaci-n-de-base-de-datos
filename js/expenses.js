/**
 * 💰 MÓDULO DE GASTOS OPTIMIZADO - POS Conejo Negro
 * Versión mejorada con ExpensesAPI client y funcionalidades avanzadas
 */

// Namespace global para el módulo de gastos
window.Expenses = (() => {
    // Estado del módulo
    let state = {
        initialized: false,
        expenses: [],
        categories: {},
        stats: {},
        filters: {
            category: '',
            startDate: '',
            endDate: '',
            status: '',
            type: ''
        },
        isLoading: false,
        currentExpense: null
    };

    // ==========================================
    // FUNCIONES DE INICIALIZACIÓN
    // ==========================================

    /**
     * Inicializar el módulo de gastos
     */
    async function init() {
        if (state.initialized) {
            console.log('💰 Expenses module already initialized');
            return;
        }

        console.log('💰 Initializing Expenses module...');
        
        try {
            // Verificar que ExpensesAPI esté disponible
            if (typeof window.ExpensesAPI === 'undefined') {
                throw new Error('ExpensesAPI client not loaded. Include js/api/expensesApi.js');
            }

            // Configurar event listeners
            setupEventListeners();
            
            // Cargar datos iniciales en paralelo
            showLoading(true);
            await Promise.all([
                loadCategories(),
                loadStats(),
                loadExpenses()
            ]);
            
            state.initialized = true;
            console.log('✅ Expenses module initialized successfully');
            
        } catch (error) {
            console.error('❌ Error initializing Expenses module:', error);
            showNotification(getErrorMessage(error), 'error');
        } finally {
            showLoading(false);
        }
    }

    /**
     * Configurar event listeners
     */
    function setupEventListeners() {
        const root = document.getElementById('expenses-root');
        if (!root) {
            console.warn('⚠️ expenses-root element not found');
            return;
        }

        // Event delegation para optimizar performance
        root.addEventListener('click', handleButtonClick);
        root.addEventListener('change', handleInputChange);
        root.addEventListener('submit', handleFormSubmit);
    }

    // ==========================================
    // MANEJO DE EVENTOS
    // ==========================================

    /**
     * Manejar clics en botones
     */
    function handleButtonClick(e) {
        const button = e.target.closest('button');
        if (!button) return;

        const action = button.dataset.action || button.id;
        const expenseId = button.dataset.expenseId;

        switch (action) {
            case 'add-expense':
            case 'expenses-add-btn':
                openExpenseModal();
                break;
            case 'edit-expense':
                if (expenseId) editExpense(expenseId);
                break;
            case 'delete-expense':
                if (expenseId) deleteExpense(expenseId);
                break;
            case 'filter-expenses':
                applyFilters();
                break;
            case 'clear-filters':
                clearFilters();
                break;
            case 'export-expenses':
                exportExpenses();
                break;
            default:
                console.log('Unknown button action:', action);
        }
    }

    /**
     * Manejar cambios en inputs
     */
    function handleInputChange(e) {
        const input = e.target;
        const filterId = input.id;

        // Actualizar filtros automáticamente
        if (filterId.startsWith('expenses-filtro') || filterId.startsWith('expenses-fecha')) {
            updateFiltersFromInputs();
            // Debounce para evitar demasiadas llamadas
            clearTimeout(state.filterTimeout);
            state.filterTimeout = setTimeout(() => {
                loadExpenses(state.filters);
            }, 500);
        }
    }

    /**
     * Manejar envío de formularios
     */
    function handleFormSubmit(e) {
        if (e.target.id === 'expense-form') {
            e.preventDefault();
            submitExpenseForm();
        }
    }

    // ==========================================
    // FUNCIONES DE DATOS
    // ==========================================

    /**
     * Cargar categorías de gastos
     */
    async function loadCategories() {
        try {
            console.log('🏷️ Loading expense categories...');
            const categoriesData = await window.ExpensesAPI.categories();
            
            state.categories = categoriesData;
            renderCategoryOptions();
            
            console.log('✅ Categories loaded:', Object.keys(state.categories).length);
        } catch (error) {
            console.error('❌ Error loading categories:', error);
            showNotification(getErrorMessage(error), 'error');
            
            // Fallback a categorías por defecto
            state.categories = getDefaultCategories();
            renderCategoryOptions();
        }
    }

    /**
     * Cargar estadísticas de gastos
     */
    async function loadStats() {
        try {
            console.log('📊 Loading expense statistics...');
            const statsData = await window.ExpensesAPI.stats();
            
            state.stats = statsData;
            renderStats();
            
            console.log('✅ Statistics loaded');
        } catch (error) {
            console.error('❌ Error loading statistics:', error);
            // No mostrar error para stats, solo log
        }
    }

    /**
     * Cargar gastos con filtros
     */
    async function loadExpenses(filters = null) {
        try {
            state.isLoading = true;
            showLoading(true);
            
            // Usar filtros proporcionados o los del estado
            const currentFilters = filters || state.filters;
            
            console.log('📋 Loading expenses with filters:', currentFilters);
            
            // Llamada a la API real
            const expensesData = await window.ExpensesAPI.list(currentFilters);
            
            state.expenses = expensesData.expenses || [];
            renderExpenses();
            
            console.log(`✅ Loaded ${state.expenses.length} expenses`);
            
        } catch (error) {
            console.error('❌ Error loading expenses:', error);
            showNotification(getErrorMessage(error), 'error');
            
            // Mostrar estado vacío en caso de error
            state.expenses = [];
            renderExpenses();
        } finally {
            state.isLoading = false;
            showLoading(false);
        }
    }

    // ==========================================
    // OPERACIONES CRUD
    // ==========================================

    /**
     * Crear nuevo gasto
     */
    async function createExpense(expenseData) {
        try {
            state.isLoading = true;
            showLoading(true);
            
            console.log('💰 Creating expense:', expenseData);
            
            // Llamada a la API real
            const result = await window.ExpensesAPI.create(expenseData);
            
            showNotification(result.message || 'Gasto creado exitosamente', 'success');
            
            // Recargar datos
            await Promise.all([
                loadExpenses(),
                loadStats()
            ]);
            
            return result;
            
        } catch (error) {
            console.error('❌ Error creating expense:', error);
            showNotification(getErrorMessage(error), 'error');
            throw error;
        } finally {
            state.isLoading = false;
            showLoading(false);
        }
    }

    /**
     * Editar gasto existente
     */
    async function editExpense(expenseId, updateData = null) {
        try {
            // Si no hay updateData, abrir modal de edición
            if (!updateData) {
                const expense = state.expenses.find(e => e.id === expenseId);
                if (expense) {
                    openExpenseModal(expense);
                }
                return;
            }

            state.isLoading = true;
            showLoading(true);
            
            console.log('✏️ Editing expense:', expenseId, updateData);
            
            // Llamada a la API real
            const result = await window.ExpensesAPI.update(expenseId, updateData);
            
            showNotification(result.message || 'Gasto actualizado exitosamente', 'success');
            
            // Recargar datos
            await Promise.all([
                loadExpenses(),
                loadStats()
            ]);
            
            return result;
            
        } catch (error) {
            console.error('❌ Error editing expense:', error);
            showNotification(getErrorMessage(error), 'error');
            throw error;
        } finally {
            state.isLoading = false;
            showLoading(false);
        }
    }

    /**
     * Eliminar gasto
     */
    async function deleteExpense(expenseId) {
        try {
            // Confirmar eliminación
            if (!confirm('¿Está seguro de eliminar este gasto?')) {
                return;
            }
            
            state.isLoading = true;
            showLoading(true);
            
            console.log('🗑️ Deleting expense:', expenseId);
            
            // Llamada a la API real
            const result = await window.ExpensesAPI.delete(expenseId);
            
            showNotification(result.message || 'Gasto eliminado exitosamente', 'success');
            
            // Recargar datos
            await Promise.all([
                loadExpenses(),
                loadStats()
            ]);
            
            return result;
            
        } catch (error) {
            console.error('❌ Error deleting expense:', error);
            showNotification(getErrorMessage(error), 'error');
            throw error;
        } finally {
            state.isLoading = false;
            showLoading(false);
        }
    }

    // ==========================================
    // FUNCIONES DE RENDERIZADO
    // ==========================================

    /**
     * Renderizar opciones de categorías
     */
    function renderCategoryOptions() {
        const categorySelects = document.querySelectorAll('#expenses-filtro-categoria, #expense-category');
        
        categorySelects.forEach(select => {
            if (!select) return;
            
            // Mantener opción "todos" si existe
            const allOption = select.querySelector('option[value=""]');
            const allOptionHtml = allOption ? allOption.outerHTML : '<option value="">Todas las categorías</option>';
            
            const categoriesHtml = Object.entries(state.categories).map(([key, category]) => 
                `<option value="${key}">${category.name}</option>`
            ).join('');
            
            select.innerHTML = allOptionHtml + categoriesHtml;
        });
    }

    /**
     * Renderizar estadísticas
     */
    function renderStats() {
        const statsContainer = document.querySelector('.expenses-stats-grid');
        if (!statsContainer || !state.stats) return;

        // Ejemplo de estadísticas básicas
        const totalAmount = state.expenses.reduce((sum, expense) => sum + (expense.amount || 0), 0);
        const totalCount = state.expenses.length;
        const avgAmount = totalCount > 0 ? totalAmount / totalCount : 0;

        statsContainer.innerHTML = `
            <div class="stat-card">
                <div class="stat-icon"><i class="fas fa-coins"></i></div>
                <div class="stat-info">
                    <div class="stat-value">$${totalAmount.toLocaleString()}</div>
                    <div class="stat-label">Total Gastos</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon"><i class="fas fa-receipt"></i></div>
                <div class="stat-info">
                    <div class="stat-value">${totalCount}</div>
                    <div class="stat-label">Cantidad</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon"><i class="fas fa-calculator"></i></div>
                <div class="stat-info">
                    <div class="stat-value">$${avgAmount.toLocaleString()}</div>
                    <div class="stat-label">Promedio</div>
                </div>
            </div>
        `;
    }

    /**
     * Renderizar lista de gastos
     */
    function renderExpenses() {
        const grid = document.getElementById('expenses-grid');
        if (!grid) return;

        if (state.expenses.length === 0) {
            grid.innerHTML = `
                <div class="expenses-empty-state">
                    <i class="fas fa-receipt"></i>
                    <h3>No hay gastos registrados</h3>
                    <p>Comienza agregando tu primer gasto</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = state.expenses.map(expense => createExpenseCard(expense)).join('');
    }

    /**
     * Crear tarjeta de gasto
     */
    function createExpenseCard(expense) {
        const categoryInfo = state.categories[expense.category] || { 
            name: expense.category, 
            icon: 'fas fa-receipt',
            color: '#999999'
        };
        
        const formattedDate = new Date(expense.date).toLocaleDateString('es-ES');
        const formattedAmount = `$${expense.amount.toLocaleString()}`;
        const statusClass = (expense.status || 'pagado').toLowerCase();

        return `
            <div class="expense-card">
                <div class="expense-header">
                    <div class="expense-amount">${formattedAmount}</div>
                    <div class="expense-status ${statusClass}">${expense.status || 'Pagado'}</div>
                </div>
                
                <div class="expense-category">
                    <i class="${categoryInfo.icon}" style="color: ${categoryInfo.color}"></i>
                    ${categoryInfo.name}
                </div>
                
                <div class="expense-description">${expense.description}</div>
                
                <div class="expense-meta">
                    <div><i class="fas fa-calendar"></i> ${formattedDate}</div>
                    <div><i class="fas fa-credit-card"></i> ${expense.paymentMethod || 'Efectivo'}</div>
                    ${expense.supplier ? `<div><i class="fas fa-store"></i> ${expense.supplier}</div>` : ''}
                </div>
                
                <div class="expense-actions">
                    <button type="button" class="btn btn-sm btn-outline-primary" 
                            data-action="edit-expense" data-expense-id="${expense.id}">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                    <button type="button" class="btn btn-sm btn-outline-danger" 
                            data-action="delete-expense" data-expense-id="${expense.id}">
                        <i class="fas fa-trash"></i> Eliminar
                    </button>
                </div>
            </div>
        `;
    }

    // ==========================================
    // FUNCIONES DE MODAL Y FORMULARIO
    // ==========================================

    /**
     * Abrir modal de gasto
     */
    function openExpenseModal(expense = null) {
        // Implementación básica - expandir según necesidades
        const modalHtml = `
            <div class="modal fade" id="expenseModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">${expense ? 'Editar Gasto' : 'Nuevo Gasto'}</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            ${createExpenseForm(expense)}
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Agregar modal al DOM
        let modalContainer = document.getElementById('expense-modal-container');
        if (!modalContainer) {
            modalContainer = document.createElement('div');
            modalContainer.id = 'expense-modal-container';
            document.body.appendChild(modalContainer);
        }
        
        modalContainer.innerHTML = modalHtml;
        
        // Mostrar modal (usar Bootstrap modal o implementación custom)
        const modal = document.getElementById('expenseModal');
        if (modal) {
            modal.style.display = 'block';
            modal.classList.add('show');
        }
    }

    /**
     * Crear formulario de gasto
     */
    function createExpenseForm(expense = null) {
        return `
            <form id="expense-form">
                <div class="row">
                    <div class="col-md-6">
                        <div class="mb-3">
                            <label for="expense-amount" class="form-label">Monto *</label>
                            <input type="number" class="form-control" id="expense-amount" 
                                   value="${expense?.amount || ''}" required step="0.01" min="0.01">
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="mb-3">
                            <label for="expense-category" class="form-label">Categoría *</label>
                            <select class="form-control" id="expense-category" required>
                                <option value="">Seleccionar categoría</option>
                                ${Object.entries(state.categories).map(([key, category]) => 
                                    `<option value="${key}" ${expense?.category === key ? 'selected' : ''}>${category.name}</option>`
                                ).join('')}
                            </select>
                        </div>
                    </div>
                </div>
                
                <div class="mb-3">
                    <label for="expense-description" class="form-label">Descripción *</label>
                    <input type="text" class="form-control" id="expense-description" 
                           value="${expense?.description || ''}" required>
                </div>
                
                <div class="row">
                    <div class="col-md-6">
                        <div class="mb-3">
                            <label for="expense-date" class="form-label">Fecha</label>
                            <input type="date" class="form-control" id="expense-date" 
                                   value="${expense?.date?.split('T')[0] || new Date().toISOString().split('T')[0]}">
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="mb-3">
                            <label for="expense-payment-method" class="form-label">Método de Pago</label>
                            <select class="form-control" id="expense-payment-method">
                                <option value="efectivo" ${expense?.paymentMethod === 'efectivo' ? 'selected' : ''}>Efectivo</option>
                                <option value="transferencia" ${expense?.paymentMethod === 'transferencia' ? 'selected' : ''}>Transferencia</option>
                                <option value="tarjeta" ${expense?.paymentMethod === 'tarjeta' ? 'selected' : ''}>Tarjeta</option>
                            </select>
                        </div>
                    </div>
                </div>
                
                <div class="mb-3">
                    <label for="expense-supplier" class="form-label">Proveedor</label>
                    <input type="text" class="form-control" id="expense-supplier" 
                           value="${expense?.supplier || ''}">
                </div>
                
                <div class="mb-3">
                    <label for="expense-notes" class="form-label">Notas</label>
                    <textarea class="form-control" id="expense-notes" rows="3">${expense?.notes || ''}</textarea>
                </div>
                
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" onclick="closeExpenseModal()">Cancelar</button>
                    <button type="submit" class="btn btn-primary">
                        ${expense ? 'Actualizar' : 'Crear'} Gasto
                    </button>
                </div>
                
                ${expense ? `<input type="hidden" id="expense-id" value="${expense.id}">` : ''}
            </form>
        `;
    }

    /**
     * Enviar formulario de gasto
     */
    async function submitExpenseForm() {
        const form = document.getElementById('expense-form');
        if (!form) return;

        const formData = {
            amount: parseFloat(document.getElementById('expense-amount').value),
            description: document.getElementById('expense-description').value,
            category: document.getElementById('expense-category').value,
            date: document.getElementById('expense-date').value,
            paymentMethod: document.getElementById('expense-payment-method').value,
            supplier: document.getElementById('expense-supplier').value,
            notes: document.getElementById('expense-notes').value
        };

        const expenseId = document.getElementById('expense-id')?.value;

        try {
            if (expenseId) {
                await editExpense(expenseId, formData);
            } else {
                await createExpense(formData);
            }
            
            closeExpenseModal();
        } catch (error) {
            console.error('Error submitting form:', error);
        }
    }

    /**
     * Cerrar modal de gasto
     */
    function closeExpenseModal() {
        const modal = document.getElementById('expenseModal');
        if (modal) {
            modal.style.display = 'none';
            modal.classList.remove('show');
        }
    }

    // ==========================================
    // FUNCIONES DE FILTROS
    // ==========================================

    /**
     * Actualizar filtros desde inputs
     */
    function updateFiltersFromInputs() {
        state.filters = {
            category: document.getElementById('expenses-filtro-categoria')?.value || '',
            startDate: document.getElementById('expenses-fecha-desde')?.value || '',
            endDate: document.getElementById('expenses-fecha-hasta')?.value || '',
            status: document.getElementById('expenses-filtro-estado')?.value || '',
            type: document.getElementById('expenses-filtro-tipo')?.value || ''
        };
    }

    /**
     * Aplicar filtros
     */
    function applyFilters() {
        updateFiltersFromInputs();
        loadExpenses(state.filters);
    }

    /**
     * Limpiar filtros
     */
    function clearFilters() {
        state.filters = {
            category: '',
            startDate: '',
            endDate: '',
            status: '',
            type: ''
        };

        // Limpiar inputs
        const inputs = ['expenses-filtro-categoria', 'expenses-fecha-desde', 'expenses-fecha-hasta', 'expenses-filtro-estado', 'expenses-filtro-tipo'];
        inputs.forEach(id => {
            const input = document.getElementById(id);
            if (input) input.value = '';
        });

        loadExpenses();
    }

    // ==========================================
    // FUNCIONES AUXILIARES
    // ==========================================

    /**
     * Mostrar/ocultar loading
     */
    function showLoading(show) {
        const loader = document.getElementById('expenses-loading');
        if (loader) {
            loader.style.display = show ? 'flex' : 'none';
        }
    }

    /**
     * Mostrar notificación
     */
    function showNotification(message, type = 'info') {
        console.log(`📢 ${type.toUpperCase()}: ${message}`);
        
        // Implementar notificación visual si existe el sistema
        if (window.showNotification) {
            window.showNotification(message, type);
        }
    }

    /**
     * Obtener mensaje de error formateado
     */
    function getErrorMessage(error) {
        if (error.isNetworkError) {
            return 'Error de conexión. Verifique su conexión a internet.';
        }
        
        if (error.isAuthError) {
            return 'Sesión expirada. Por favor, inicie sesión nuevamente.';
        }
        
        if (error.isPermissionError) {
            return 'No tiene permisos para realizar esta acción.';
        }
        
        return error.message || 'Ha ocurrido un error inesperado.';
    }

    /**
     * Obtener categorías por defecto
     */
    function getDefaultCategories() {
        return {
            'gastos-fijos': { name: 'Gastos Fijos', icon: 'fas fa-home', color: '#ff4757' },
            'sueldos': { name: 'Sueldos', icon: 'fas fa-users', color: '#5352ed' },
            'insumos': { name: 'Insumos', icon: 'fas fa-boxes', color: '#00d2d3' },
            'mantenimiento': { name: 'Mantenimiento', icon: 'fas fa-tools', color: '#ff9ff3' },
            'marketing': { name: 'Marketing', icon: 'fas fa-bullhorn', color: '#54a0ff' },
            'operativos': { name: 'Operativos', icon: 'fas fa-cog', color: '#2ed573' },
            'otros': { name: 'Otros', icon: 'fas fa-ellipsis-h', color: '#a4b0be' }
        };
    }

    // ==========================================
    // HOOKS DEL MÓDULO
    // ==========================================

    /**
     * Hook cuando se entra a la sección gastos
     */
    function onEnter() {
        console.log('💰 Entering expenses section');
        init();
    }

    /**
     * Hook cuando se sale de la sección gastos
     */
    function onLeave() {
        console.log('💰 Leaving expenses section');
        // Limpiar timers si existen
        if (state.filterTimeout) {
            clearTimeout(state.filterTimeout);
        }
    }

    // ==========================================
    // API PÚBLICA DEL MÓDULO
    // ==========================================

    return {
        // Hooks principales
        onEnter,
        onLeave,
        init,
        
        // Funciones de datos
        loadExpenses,
        loadCategories,
        loadStats,
        
        // Operaciones CRUD
        createExpense,
        editExpense,
        deleteExpense,
        
        // Funciones de UI
        openExpenseModal,
        closeExpenseModal,
        applyFilters,
        clearFilters,
        
        // Estado (solo lectura)
        getState: () => ({ ...state }),
        
        // Funciones auxiliares
        showNotification
    };
})();

// Inicialización automática si estamos en la sección correcta
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('expenses-root')) {
        console.log('💰 Expenses section detected, initializing...');
        window.Expenses.init();
    }
});

console.log('💰 Expenses module loaded successfully');
