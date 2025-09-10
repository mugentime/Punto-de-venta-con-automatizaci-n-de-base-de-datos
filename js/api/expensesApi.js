/**
 * 💰 EXPENSES API CLIENT - POS Conejo Negro
 * Cliente API optimizado para gestión de gastos
 * 
 * Características:
 * - Patrón de autenticación consistente con la app
 * - Manejo de errores robusto
 * - Retry automático en fallos de red
 * - Cache inteligente para mejor performance
 * - Support offline básico
 */

class ExpensesAPI {
    constructor() {
        this.baseURL = this._getAPIBaseURL();
        this.cache = new Map();
        this.retryCount = 3;
        this.retryDelay = 1000; // 1 segundo
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutos
        
        // Bind methods para evitar issues con 'this'
        this.list = this.list.bind(this);
        this.create = this.create.bind(this);
        this.update = this.update.bind(this);
        this.delete = this.delete.bind(this);
        this.categories = this.categories.bind(this);
        
        console.log('🚀 ExpensesAPI initialized with base URL:', this.baseURL);
    }
    
    /**
     * Obtener URL base de la API
     * @returns {string} Base URL de la API
     */
    _getAPIBaseURL() {
        // Si está ejecutándose desde file:// (local), usar servidor de producción
        if (window.location.protocol === 'file:') {
            return 'https://pos-conejo-negro.onrender.com/api';
        }
        
        const isLocalhost = window.location.hostname === 'localhost' || 
                           window.location.hostname === '127.0.0.1';
        
        return isLocalhost 
            ? 'http://localhost:3000/api' 
            : `${window.location.protocol}//${window.location.host}/api`;
    }
    
    /**
     * Obtener token de autenticación
     * @returns {string|null} Token JWT
     */
    _getAuthToken() {
        return localStorage.getItem('authToken');
    }
    
    /**
     * Crear headers para las requests
     * @returns {object} Headers HTTP
     */
    _createHeaders() {
        const token = this._getAuthToken();
        const headers = {
            'Content-Type': 'application/json'
        };
        
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        return headers;
    }
    
    /**
     * Realizar request HTTP con retry automático
     * @param {string} url - URL del endpoint
     * @param {object} options - Opciones de fetch
     * @returns {Promise<any>} Respuesta de la API
     */
    async _makeRequest(url, options = {}) {
        const fullURL = `${this.baseURL}${url}`;
        const requestOptions = {
            ...options,
            headers: {
                ...this._createHeaders(),
                ...options.headers
            }
        };
        
        console.log(`🌐 API Request: ${options.method || 'GET'} ${fullURL}`);
        
        for (let attempt = 1; attempt <= this.retryCount; attempt++) {
            try {
                const response = await fetch(fullURL, requestOptions);
                
                // Log response status
                console.log(`📊 API Response: ${response.status} ${response.statusText}`);
                
                // Manejar diferentes tipos de respuestas
                if (response.ok) {
                    const data = await response.json();
                    return this._handleSuccessResponse(data);
                } else {
                    // Intentar parsear error response
                    let errorData;
                    try {
                        errorData = await response.json();
                    } catch {
                        errorData = { error: `HTTP ${response.status}: ${response.statusText}` };
                    }
                    
                    throw this._createAPIError(response.status, errorData);
                }
            } catch (error) {
                console.warn(`⚠️ API Request failed (attempt ${attempt}/${this.retryCount}):`, error.message);
                
                // Si es el último intento, lanzar el error
                if (attempt === this.retryCount) {
                    throw this._handleAPIError(error);
                }
                
                // Esperar antes del siguiente intento
                await this._delay(this.retryDelay * attempt);
            }
        }
    }
    
    /**
     * Manejar respuesta exitosa
     * @param {any} data - Datos de respuesta
     * @returns {any} Datos procesados
     */
    _handleSuccessResponse(data) {
        // Si la respuesta tiene formato estándar con 'expenses' array
        if (data.expenses) {
            console.log(`✅ Received ${data.expenses.length} expenses`);
            return data;
        }
        
        // Si es un array directo de gastos
        if (Array.isArray(data)) {
            console.log(`✅ Received ${data.length} expenses (array format)`);
            return { expenses: data, count: data.length };
        }
        
        // Respuesta de operación (create, update, delete)
        if (data.message) {
            console.log(`✅ Operation successful: ${data.message}`);
        }
        
        return data;
    }
    
    /**
     * Crear error de API
     * @param {number} status - Status HTTP
     * @param {object} errorData - Datos del error
     * @returns {Error} Error formateado
     */
    _createAPIError(status, errorData) {
        const error = new Error(errorData.error || `HTTP ${status} Error`);
        error.status = status;
        error.details = errorData.details || null;
        error.isAPIError = true;
        return error;
    }
    
    /**
     * Manejar errores de API
     * @param {Error} error - Error original
     * @returns {Error} Error procesado
     */
    _handleAPIError(error) {
        if (error.isAPIError) {
            return error;
        }
        
        // Error de red o timeout
        if (error.name === 'TypeError' || error.message.includes('fetch')) {
            const networkError = new Error('Error de conexión. Verifique su conexión a internet.');
            networkError.isNetworkError = true;
            return networkError;
        }
        
        // Error de autenticación
        if (error.status === 401) {
            const authError = new Error('Sesión expirada. Por favor, inicie sesión nuevamente.');
            authError.isAuthError = true;
            return authError;
        }
        
        // Error de permisos
        if (error.status === 403) {
            const permissionError = new Error('No tiene permisos para realizar esta acción.');
            permissionError.isPermissionError = true;
            return permissionError;
        }
        
        return error;
    }
    
    /**
     * Delay para retry
     * @param {number} ms - Milisegundos de espera
     * @returns {Promise} Promesa de delay
     */
    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * Obtener clave de cache
     * @param {string} method - Método HTTP
     * @param {string} endpoint - Endpoint
     * @param {object} params - Parámetros
     * @returns {string} Clave de cache
     */
    _getCacheKey(method, endpoint, params = {}) {
        const paramsStr = JSON.stringify(params);
        return `${method}:${endpoint}:${paramsStr}`;
    }
    
    /**
     * Obtener datos del cache
     * @param {string} key - Clave de cache
     * @returns {any|null} Datos del cache o null
     */
    _getFromCache(key) {
        const cached = this.cache.get(key);
        if (!cached) return null;
        
        const { data, timestamp } = cached;
        const isExpired = Date.now() - timestamp > this.cacheTimeout;
        
        if (isExpired) {
            this.cache.delete(key);
            return null;
        }
        
        console.log('📦 Using cached data for:', key);
        return data;
    }
    
    /**
     * Guardar datos en cache
     * @param {string} key - Clave de cache
     * @param {any} data - Datos a cachear
     */
    _setCache(key, data) {
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
    }
    
    /**
     * Invalidar cache relacionado con gastos
     * @param {string} pattern - Patrón a invalidar
     */
    _invalidateCache(pattern = 'GET:/expenses') {
        const keysToDelete = [];
        for (const key of this.cache.keys()) {
            if (key.includes(pattern)) {
                keysToDelete.push(key);
            }
        }
        keysToDelete.forEach(key => this.cache.delete(key));
        console.log(`🗑️ Invalidated ${keysToDelete.length} cache entries`);
    }
    
    // ==========================================
    // MÉTODOS PÚBLICOS DE LA API
    // ==========================================
    
    /**
     * 📋 Listar gastos con filtros
     * @param {object} filters - Filtros de búsqueda
     * @param {string} filters.category - Categoría
     * @param {string} filters.startDate - Fecha de inicio (YYYY-MM-DD)
     * @param {string} filters.endDate - Fecha de fin (YYYY-MM-DD)
     * @param {string} filters.type - Tipo de gasto (unico, recurrente)
     * @param {string} filters.status - Estado (pagado, pendiente, vencido)
     * @param {number} filters.limit - Límite de resultados (default: 50)
     * @param {string} filters.sortBy - Ordenar por (date, amount, category)
     * @param {string} filters.order - Orden (asc, desc)
     * @returns {Promise<object>} Lista de gastos
     */
    async list(filters = {}) {
        console.log('📋 Fetching expenses with filters:', filters);
        
        // Crear query string
        const params = new URLSearchParams();
        Object.entries(filters).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
                params.append(key, value);
            }
        });
        
        const queryString = params.toString();
        const endpoint = `/expenses${queryString ? '?' + queryString : ''}`;
        const cacheKey = this._getCacheKey('GET', endpoint, filters);
        
        // Intentar obtener del cache
        const cached = this._getFromCache(cacheKey);
        if (cached) {
            return cached;
        }
        
        try {
            const data = await this._makeRequest(endpoint);
            this._setCache(cacheKey, data);
            return data;
        } catch (error) {
            console.error('❌ Error fetching expenses:', error);
            throw error;
        }
    }
    
    /**
     * 💰 Crear nuevo gasto
     * @param {object} expenseData - Datos del gasto
     * @param {number} expenseData.amount - Monto (requerido)
     * @param {string} expenseData.description - Descripción (requerida)
     * @param {string} expenseData.category - Categoría (requerida)
     * @param {string} expenseData.subcategory - Subcategoría
     * @param {string} expenseData.date - Fecha (YYYY-MM-DD)
     * @param {string} expenseData.type - Tipo (unico, recurrente)
     * @param {string} expenseData.paymentMethod - Método de pago
     * @param {string} expenseData.supplier - Proveedor
     * @param {string} expenseData.notes - Notas adicionales
     * @returns {Promise<object>} Gasto creado
     */
    async create(expenseData) {
        console.log('💰 Creating expense:', expenseData);
        
        // Validaciones básicas
        if (!expenseData.amount || expenseData.amount <= 0) {
            throw new Error('El monto es requerido y debe ser mayor a 0');
        }
        
        if (!expenseData.description || expenseData.description.trim().length < 3) {
            throw new Error('La descripción es requerida y debe tener al menos 3 caracteres');
        }
        
        if (!expenseData.category) {
            throw new Error('La categoría es requerida');
        }
        
        try {
            const data = await this._makeRequest('/expenses', {
                method: 'POST',
                body: JSON.stringify(expenseData)
            });
            
            // Invalidar cache de listados
            this._invalidateCache('GET:/expenses');
            
            return data;
        } catch (error) {
            console.error('❌ Error creating expense:', error);
            throw error;
        }
    }
    
    /**
     * ✏️ Actualizar gasto existente
     * @param {string} expenseId - ID del gasto
     * @param {object} updateData - Datos a actualizar
     * @returns {Promise<object>} Gasto actualizado
     */
    async update(expenseId, updateData) {
        console.log('✏️ Updating expense:', expenseId, updateData);
        
        if (!expenseId) {
            throw new Error('ID del gasto es requerido para actualizar');
        }
        
        try {
            const data = await this._makeRequest(`/expenses/${expenseId}`, {
                method: 'PUT',
                body: JSON.stringify(updateData)
            });
            
            // Invalidar cache
            this._invalidateCache('GET:/expenses');
            
            return data;
        } catch (error) {
            console.error('❌ Error updating expense:', error);
            throw error;
        }
    }
    
    /**
     * 🗑️ Eliminar gasto
     * @param {string} expenseId - ID del gasto
     * @returns {Promise<object>} Confirmación de eliminación
     */
    async delete(expenseId) {
        console.log('🗑️ Deleting expense:', expenseId);
        
        if (!expenseId) {
            throw new Error('ID del gasto es requerido para eliminar');
        }
        
        try {
            const data = await this._makeRequest(`/expenses/${expenseId}`, {
                method: 'DELETE'
            });
            
            // Invalidar cache
            this._invalidateCache('GET:/expenses');
            
            return data;
        } catch (error) {
            console.error('❌ Error deleting expense:', error);
            throw error;
        }
    }
    
    /**
     * 📊 Obtener gasto por ID
     * @param {string} expenseId - ID del gasto
     * @returns {Promise<object>} Detalles del gasto
     */
    async getById(expenseId) {
        console.log('📊 Fetching expense by ID:', expenseId);
        
        if (!expenseId) {
            throw new Error('ID del gasto es requerido');
        }
        
        const endpoint = `/expenses/${expenseId}`;
        const cacheKey = this._getCacheKey('GET', endpoint);
        
        // Intentar obtener del cache
        const cached = this._getFromCache(cacheKey);
        if (cached) {
            return cached;
        }
        
        try {
            const data = await this._makeRequest(endpoint);
            this._setCache(cacheKey, data);
            return data;
        } catch (error) {
            console.error('❌ Error fetching expense by ID:', error);
            throw error;
        }
    }
    
    /**
     * 🏷️ Obtener categorías de gastos
     * @returns {Promise<object>} Categorías disponibles
     */
    async categories() {
        console.log('🏷️ Fetching expense categories');
        
        const endpoint = '/expenses/categories';
        const cacheKey = this._getCacheKey('GET', endpoint);
        
        // Intentar obtener del cache (cache más largo para categorías)
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < 15 * 60 * 1000) { // 15 minutos
            console.log('📦 Using cached categories');
            return cached.data;
        }
        
        try {
            const data = await this._makeRequest(endpoint);
            this._setCache(cacheKey, data);
            return data;
        } catch (error) {
            console.error('❌ Error fetching categories:', error);
            throw error;
        }
    }
    
    /**
     * 📈 Obtener estadísticas de gastos
     * @returns {Promise<object>} Estadísticas
     */
    async stats() {
        console.log('📈 Fetching expense statistics');
        
        const endpoint = '/expenses/stats';
        const cacheKey = this._getCacheKey('GET', endpoint);
        
        // Cache corto para estadísticas (2 minutos)
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < 2 * 60 * 1000) {
            console.log('📦 Using cached stats');
            return cached.data;
        }
        
        try {
            const data = await this._makeRequest(endpoint);
            this._setCache(cacheKey, data);
            return data;
        } catch (error) {
            console.error('❌ Error fetching statistics:', error);
            throw error;
        }
    }
    
    /**
     * 📄 Obtener reporte financiero
     * @param {string} period - Período (current-month, last-month, current-year, etc.)
     * @returns {Promise<object>} Reporte financiero
     */
    async financialReport(period = 'current-month') {
        console.log('📄 Fetching financial report for period:', period);
        
        const endpoint = `/expenses/financial-report/${period}`;
        const cacheKey = this._getCacheKey('GET', endpoint);
        
        // Cache de 5 minutos para reportes
        const cached = this._getFromCache(cacheKey);
        if (cached) {
            return cached;
        }
        
        try {
            const data = await this._makeRequest(endpoint);
            this._setCache(cacheKey, data);
            return data;
        } catch (error) {
            console.error('❌ Error fetching financial report:', error);
            throw error;
        }
    }
    
    /**
     * 💳 Marcar gasto recurrente como pagado
     * @param {string} expenseId - ID del gasto recurrente
     * @returns {Promise<object>} Gasto actualizado
     */
    async markAsPaid(expenseId) {
        console.log('💳 Marking recurring expense as paid:', expenseId);
        
        if (!expenseId) {
            throw new Error('ID del gasto es requerido');
        }
        
        try {
            const data = await this._makeRequest(`/expenses/${expenseId}/pay`, {
                method: 'POST'
            });
            
            // Invalidar cache
            this._invalidateCache('GET:/expenses');
            
            return data;
        } catch (error) {
            console.error('❌ Error marking expense as paid:', error);
            throw error;
        }
    }
    
    /**
     * ⚠️ Obtener gastos vencidos
     * @returns {Promise<object>} Gastos vencidos
     */
    async getOverdue() {
        console.log('⚠️ Fetching overdue expenses');
        
        const endpoint = '/expenses/status/overdue';
        const cacheKey = this._getCacheKey('GET', endpoint);
        
        // Cache corto para gastos vencidos (1 minuto)
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < 1 * 60 * 1000) {
            console.log('📦 Using cached overdue expenses');
            return cached.data;
        }
        
        try {
            const data = await this._makeRequest(endpoint);
            this._setCache(cacheKey, data);
            return data;
        } catch (error) {
            console.error('❌ Error fetching overdue expenses:', error);
            throw error;
        }
    }
    
    /**
     * 🗑️ Limpiar cache completo
     */
    clearCache() {
        this.cache.clear();
        console.log('🧹 Cache cleared');
    }
    
    /**
     * 📊 Obtener información del cache
     * @returns {object} Estadísticas del cache
     */
    getCacheInfo() {
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys()),
            timeout: this.cacheTimeout
        };
    }
}

// Crear instancia global
window.ExpensesAPI = new ExpensesAPI();

// Export para uso como módulo
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ExpensesAPI;
}

console.log('💰 ExpensesAPI client loaded successfully');
