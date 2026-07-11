import React, { createContext, useContext, useState, ReactNode, useEffect, useRef } from 'react';
import { sessionCache, CACHE_KEYS } from '../utils/sessionCache';
import { dedupedFetch } from '../utils/apiCache';
import offlineStorage, { STORES } from '../utils/offlineStorage';
import useCart from '../hooks/useCart';
import useAuthUsers from '../hooks/useAuthUsers';
import useProducts from '../hooks/useProducts';
import useCustomers from '../hooks/useCustomers';
import useCashWithdrawals from '../hooks/useCashWithdrawals';
import useExpenses from '../hooks/useExpenses';
import useOrders from '../hooks/useOrders';
import useCoworkingSessions from '../hooks/useCoworkingSessions';
import useCashSessions from '../hooks/useCashSessions';
import type { Product, CartItem, Order, Expense, CoworkingSession, CashSession, User, Customer, CustomerCredit, CashWithdrawal } from '../types';

interface AppContextType {
    // Initialization state
    isInitializing: boolean;
    // Auth
    users: User[];
    currentUser: User | null;
    login: (username: string, password?: string) => Promise<void>;
    logout: () => void;
    register: (userDetails: Omit<User, 'id' | 'role' | 'status'>) => Promise<void>;
    approveUser: (userId: string) => void;
    deleteUser: (userId: string) => void;
    // Products
    products: Product[];
    addProduct: (product: Omit<Product, 'id'>) => Promise<void>;
    updateProduct: (product: Product) => Promise<void>;
    deleteProduct: (productId: string) => Promise<void>;
    importProducts: (importedProducts: Omit<Product, 'id'>[]) => Promise<void>;
    // Cart
    cart: CartItem[];
    addToCart: (product: Product) => void;
    removeFromCart: (productId: string) => void;
    updateCartQuantity: (productId: string, quantity: number) => void;
    clearCart: () => void;
    cartSubtotal: number;
    cartTotal: number;
    // Orders
    orders: Order[];
    createOrder: (orderDetails: { clientName: string; serviceType: 'Mesa' | 'Para llevar'; paymentMethod: 'Efectivo' | 'Tarjeta'; customerId?: string; tip?: number; }) => Promise<void>;
    deleteOrder: (orderId: string) => Promise<void>;
    refetchOrders: () => Promise<void>;
    refetchAll: () => Promise<void>;
    // Expenses
    expenses: Expense[];
    addExpense: (expense: Omit<Expense, 'id'>) => Promise<void>;
    updateExpense: (expense: Expense) => Promise<void>;
    deleteExpense: (expenseId: string) => Promise<void>;
    // Coworking
    coworkingSessions: CoworkingSession[];
    startCoworkingSession: (clientName: string) => void;
    updateCoworkingSession: (sessionId: string, updates: Partial<CoworkingSession>) => void;
    finishCoworkingSession: (sessionId: string, paymentMethod: 'Efectivo' | 'Tarjeta') => Promise<void>;
    cancelCoworkingSession: (sessionId: string) => Promise<void>;
    deleteCoworkingSession: (sessionId: string) => Promise<void>;
    // Cash
    cashSessions: CashSession[];
    cashWithdrawals: CashWithdrawal[];
    startCashSession: (startAmount: number) => void;
    closeCashSession: (endAmount: number) => void;
    addCashWithdrawal: (cashSessionId: string, amount: number, description: string) => Promise<void>;
    deleteCashWithdrawal: (withdrawalId: string) => Promise<void>;
    // Customers
    customers: Customer[];
    addCustomer: (customer: Omit<Customer, 'id' | 'createdAt' | 'currentCredit'>) => Promise<void>;
    updateCustomer: (customer: Customer) => Promise<void>;
    deleteCustomer: (customerId: string) => Promise<void>;
    addCustomerCredit: (customerId: string, amount: number, type: 'charge' | 'payment', description: string) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// Phase 5 of the architecture cleanup: this used to be a single 1,485-line
// file owning all state and every fetch call directly. Now each resource's
// state + self-contained CRUD lives in its own hook (see hooks/use*.ts).
// What's left here is exactly the part that doesn't decompose cleanly: app
// startup (cache-then-network loading for every resource at once) and the
// handful of functions that genuinely span multiple resources - createOrder
// (cart + customer discount + product stock), addExpense (cash session +
// withdrawal), finishCoworkingSession (products + orders + its own session
// update), and closeCashSession (orders + expenses + coworking + withdrawals).
export const AppContextProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const cartHook = useCart();
    const authHook = useAuthUsers();
    const productsHook = useProducts();
    const customersHook = useCustomers();
    const cashWithdrawalsHook = useCashWithdrawals();
    const expensesHook = useExpenses();
    const ordersHook = useOrders();
    const coworkingHook = useCoworkingSessions();
    const cashSessionsHook = useCashSessions();

    // PWA initialization state - prevents showing stale/empty data
    const [isInitializing, setIsInitializing] = useState(true);

    // Track if initial load from cache has been done
    const initialLoadDone = useRef(false);
    const isFetching = useRef(false); // Prevent concurrent fetches

    const fetchAllDataFromServer = async (isBackground: boolean) => {
        const logPrefix = isBackground ? '🔄 [BG]' : '🔄';

        // BACKGROUND: Fetch ALL data to ensure fresh data on PWA reload
        // FIX: Now includes customers for instant PWA loading
        if (isBackground) {
            console.log(`${logPrefix} Background refresh - fetching all data including customers`);
            try {
                const [productsData, ordersData, expensesData, coworkingData, cashData, customersData] = await Promise.all([
                    dedupedFetch<Product[]>('/api/products').catch(() => null),
                    dedupedFetch<Order[]>('/api/orders').catch(() => null),
                    dedupedFetch<Expense[]>('/api/expenses').catch(() => null),
                    dedupedFetch<CoworkingSession[]>('/api/coworking-sessions').catch(() => null),
                    dedupedFetch<any[]>('/api/cash-sessions?limit=100').catch(() => null),
                    dedupedFetch<Customer[]>('/api/customers').catch(() => null)
                ]);

                if (productsData) {
                    productsHook.hydrateProducts(productsData);
                    sessionCache.set(CACHE_KEYS.PRODUCTS, productsData);
                    offlineStorage.saveAll(STORES.PRODUCTS, productsData).catch(() => {});
                }
                if (ordersData) {
                    ordersHook.hydrateOrders(ordersData);
                    sessionCache.set(CACHE_KEYS.ORDERS, ordersData);
                    offlineStorage.saveAll(STORES.ORDERS, ordersData).catch(() => {});
                }
                if (expensesData) {
                    expensesHook.hydrateExpenses(expensesData);
                    sessionCache.set(CACHE_KEYS.EXPENSES, expensesData);
                    offlineStorage.saveAll(STORES.EXPENSES, expensesData).catch(() => {});
                }
                if (coworkingData) {
                    console.log(`${logPrefix} 🏢 Coworking sessions refreshed: ${coworkingData.length} sessions`);
                    coworkingHook.hydrateCoworkingSessions(coworkingData);
                    sessionCache.set(CACHE_KEYS.COWORKING_SESSIONS, coworkingData);
                }
                if (cashData) {
                    const mappedSessions: CashSession[] = cashData.map(session => ({
                        id: session.id,
                        startDate: session.startTime,
                        endDate: session.endTime,
                        startAmount: session.startAmount,
                        endAmount: session.endAmount,
                        status: session.status === 'active' ? 'open' : 'closed',
                        totalSales: session.totalSales,
                        totalExpenses: session.totalExpenses,
                        expectedCash: session.expectedCash,
                        difference: session.difference
                    }));
                    cashSessionsHook.hydrateCashSessions(mappedSessions);
                    sessionCache.set(CACHE_KEYS.CASH_SESSIONS, mappedSessions);
                    offlineStorage.saveAll(STORES.CASH_SESSIONS, mappedSessions).catch(() => {});
                }
                // FIX: Customers now included in background refresh for instant PWA load
                if (customersData) {
                    customersHook.hydrateCustomers(customersData);
                    sessionCache.set(CACHE_KEYS.CUSTOMERS, customersData);
                    offlineStorage.saveAll(STORES.CUSTOMERS, customersData).catch(() => {});
                    console.log(`${logPrefix} 👥 Customers refreshed: ${customersData.length} customers`);
                }
                console.log(`${logPrefix} ✅ Background refresh complete`);
            } catch (error) {
                console.error(`${logPrefix} Background refresh failed:`, error);
            }
            return;
        }

        // INITIAL LOAD: Fetch everything
        console.log(`${logPrefix} Starting initial data fetch (8 calls)...`);

        try {
            // OPTIMIZED: Parallel fetch with deduplication
            const [
                productsData,
                ordersData,
                expensesData,
                coworkingData,
                cashData,
                usersData,
                customersData,
                withdrawalsData
            ] = await Promise.all([
                dedupedFetch<Product[]>('/api/products').catch(() => null),
                dedupedFetch<Order[]>('/api/orders').catch(() => null),
                dedupedFetch<Expense[]>('/api/expenses').catch(() => null),
                dedupedFetch<CoworkingSession[]>('/api/coworking-sessions').catch(() => null),
                dedupedFetch<any[]>('/api/cash-sessions?limit=100').catch(() => null),
                dedupedFetch<User[]>('/api/users').catch(() => []),
                dedupedFetch<Customer[]>('/api/customers').catch(() => null),
                dedupedFetch<CashWithdrawal[]>('/api/cash-withdrawals').catch(() => null)
            ]);

            // Update state and caches in parallel
            if (productsData) {
                console.log(`${logPrefix} 📦 Products loaded: ${productsData.length} items`);
                productsHook.hydrateProducts(productsData);
                sessionCache.set(CACHE_KEYS.PRODUCTS, productsData);
                offlineStorage.saveAll(STORES.PRODUCTS, productsData).catch(console.error);
            }

            if (ordersData) {
                console.log(`${logPrefix} 📋 Orders loaded: ${ordersData.length} orders`);
                ordersHook.hydrateOrders(ordersData);
                sessionCache.set(CACHE_KEYS.ORDERS, ordersData);
                offlineStorage.saveAll(STORES.ORDERS, ordersData).catch(console.error);
            }

            if (expensesData) {
                expensesHook.hydrateExpenses(expensesData);
                sessionCache.set(CACHE_KEYS.EXPENSES, expensesData);
                offlineStorage.saveAll(STORES.EXPENSES, expensesData).catch(console.error);
            }

            if (coworkingData) {
                console.log(`${logPrefix} 🏢 Coworking sessions loaded: ${coworkingData.length} sessions`);
                coworkingHook.hydrateCoworkingSessions(coworkingData);
                sessionCache.set(CACHE_KEYS.COWORKING_SESSIONS, coworkingData);
            }

            if (cashData) {
                console.log(`${logPrefix} 💰 Cash sessions loaded: ${cashData.length} sessions`);
                const mappedSessions: CashSession[] = cashData.map(session => ({
                    id: session.id,
                    startDate: session.startTime,
                    endDate: session.endTime,
                    startAmount: session.startAmount,
                    endAmount: session.endAmount,
                    status: session.status === 'active' ? 'open' : 'closed',
                    totalSales: session.totalSales,
                    totalExpenses: session.totalExpenses,
                    expectedCash: session.expectedCash,
                    difference: session.difference
                }));
                cashSessionsHook.hydrateCashSessions(mappedSessions);
                sessionCache.set(CACHE_KEYS.CASH_SESSIONS, mappedSessions);
                offlineStorage.saveAll(STORES.CASH_SESSIONS, mappedSessions).catch(console.error);
            }

            if (usersData) {
                authHook.hydrateUsers(usersData);
                sessionCache.set(CACHE_KEYS.USERS, usersData);
            }

            if (customersData) {
                console.log(`${logPrefix} 👥 Customers loaded: ${customersData.length} customers`);
                customersHook.hydrateCustomers(customersData);
                sessionCache.set(CACHE_KEYS.CUSTOMERS, customersData);
                // FIX: Persist customers to IndexedDB for instant PWA reload
                offlineStorage.saveAll(STORES.CUSTOMERS, customersData).catch(console.error);
            }

            if (withdrawalsData) {
                cashWithdrawalsHook.hydrateCashWithdrawals(withdrawalsData);
                sessionCache.set(CACHE_KEYS.CASH_WITHDRAWALS, withdrawalsData);
            }

            console.log(`${logPrefix} ✅ Data fetch complete (parallel)`);
        } catch (error) {
            console.error("Failed to fetch data:", error);
            authHook.hydrateUsers([]);
        }
    };

    // Fetch all data from database on app load (with multi-tier cache)
    useEffect(() => {
        const loadFromCacheOrFetch = async () => {
            // Prevent concurrent initial loads
            if (isFetching.current) return;
            isFetching.current = true;

            try {
                // TIER 1: Try IndexedDB first (persistent across sessions)
                console.log('⚡ Checking IndexedDB for cached data...');
                const [idbProducts, idbOrders, idbExpenses, idbCashSessions, idbCustomers] = await Promise.all([
                    offlineStorage.getAll<Product>(STORES.PRODUCTS).catch(() => []),
                    offlineStorage.getAll<Order>(STORES.ORDERS).catch(() => []),
                    offlineStorage.getAll<Expense>(STORES.EXPENSES).catch(() => []),
                    offlineStorage.getAll<CashSession>(STORES.CASH_SESSIONS).catch(() => []),
                    offlineStorage.getAll<Customer>(STORES.CUSTOMERS).catch(() => [])
                ]);

                const hasIdbData = idbProducts.length > 0 || idbOrders.length > 0;

                // TIER 2: Fall back to sessionCache if no IndexedDB data
                const cachedProducts = hasIdbData ? idbProducts : sessionCache.get<Product[]>(CACHE_KEYS.PRODUCTS);
                const cachedOrders = hasIdbData ? idbOrders : sessionCache.get<Order[]>(CACHE_KEYS.ORDERS);
                const cachedExpenses = hasIdbData ? idbExpenses : sessionCache.get<Expense[]>(CACHE_KEYS.EXPENSES);
                const cachedCoworking = sessionCache.get<CoworkingSession[]>(CACHE_KEYS.COWORKING_SESSIONS);
                const cachedCashSessions = hasIdbData && idbCashSessions.length > 0 ? idbCashSessions : sessionCache.get<CashSession[]>(CACHE_KEYS.CASH_SESSIONS);
                const cachedUsers = sessionCache.get<User[]>(CACHE_KEYS.USERS);
                // FIX: Customers now loaded from IndexedDB for instant PWA load
                const cachedCustomers = idbCustomers.length > 0 ? idbCustomers : sessionCache.get<Customer[]>(CACHE_KEYS.CUSTOMERS);
                const cachedWithdrawals = sessionCache.get<CashWithdrawal[]>(CACHE_KEYS.CASH_WITHDRAWALS);

                const hasCache = (cachedProducts && cachedProducts.length > 0) || (cachedOrders && cachedOrders.length > 0) || (cachedCashSessions && cachedCashSessions.length > 0);

                if (hasCache && !initialLoadDone.current) {
                    console.log(`⚡ Loading from ${hasIdbData ? 'IndexedDB' : 'session'} cache (instant)...`);

                    // Load cached data instantly for fast first paint
                    if (cachedProducts && cachedProducts.length > 0) {
                        productsHook.hydrateProducts(cachedProducts);
                        console.log(`📦 Products from cache: ${cachedProducts.length} items`);
                    }
                    if (cachedOrders && cachedOrders.length > 0) {
                        ordersHook.hydrateOrders(cachedOrders);
                        console.log(`📋 Orders from cache: ${cachedOrders.length} orders`);
                    }
                    if (cachedExpenses && cachedExpenses.length > 0) expensesHook.hydrateExpenses(cachedExpenses);
                    if (cachedCoworking && cachedCoworking.length > 0) coworkingHook.hydrateCoworkingSessions(cachedCoworking);
                    if (cachedCashSessions && cachedCashSessions.length > 0) {
                        cashSessionsHook.hydrateCashSessions(cachedCashSessions);
                        console.log(`💰 Cash sessions from cache: ${cachedCashSessions.length} sessions`);
                    }
                    if (cachedUsers && cachedUsers.length > 0) authHook.hydrateUsers(cachedUsers);
                    if (cachedCustomers && cachedCustomers.length > 0) customersHook.hydrateCustomers(cachedCustomers);
                    if (cachedWithdrawals && cachedWithdrawals.length > 0) cashWithdrawalsHook.hydrateCashWithdrawals(cachedWithdrawals);

                    initialLoadDone.current = true;
                    // PWA FIX: Only mark as initialized if we have valid data
                    if (cachedProducts && cachedProducts.length > 0) {
                        setIsInitializing(false);
                        console.log('✅ PWA initialized with cached data');
                    }

                    // Background refresh - Start IMMEDIATELY (not deferred)
                    // FIX: Deferred refresh caused cash/expenses/coworking to load too late
                    if (navigator.onLine) {
                        console.log('🔄 Background refresh starting immediately...');
                        fetchAllDataFromServer(true).then(() => {
                            // If we didn't have cache, mark initialized after server fetch
                            setIsInitializing(false);
                        });
                    } else {
                        // Offline with no valid cache - still need to show something
                        setIsInitializing(false);
                    }
                } else {
                    // No cache, fetch everything from server
                    console.log('🔄 No cache found, fetching from server...');
                    await fetchAllDataFromServer(false);
                    initialLoadDone.current = true;
                    setIsInitializing(false);
                    console.log('✅ PWA initialized with server data');
                }
            } finally {
                isFetching.current = false;
            }
        };

        loadFromCacheOrFetch();
    }, []);

    // Order Function (updated for API)
    const createOrder = async (orderDetails: { clientName: string; serviceType: 'Mesa' | 'Para llevar'; paymentMethod: 'Efectivo' | 'Tarjeta' | 'Crédito'; customerId?: string; tip?: number; }) => {
        if (cartHook.cart.length === 0) return;

        // FIX BUG 3: Clear cart IMMEDIATELY to prevent duplicate orders during async operations
        const orderCart = [...cartHook.cart];
        const orderSubtotal = cartHook.cartSubtotal;

        // FIX BUG 1: Calculate discount from customer
        let discount = 0;
        if (orderDetails.customerId) {
            const customer = customersHook.customers.find(c => c.id === orderDetails.customerId);
            if (customer && customer.discountPercentage > 0) {
                discount = orderSubtotal * (customer.discountPercentage / 100);
                console.log(`💰 Applying ${customer.discountPercentage}% discount for ${customer.name}: -$${discount.toFixed(2)}`);
            }
        }

        const tipAmount = orderDetails.tip || 0;
        const orderTotal = orderSubtotal - discount + tipAmount;

        cartHook.clearCart();

        console.log('💾 Creating order...', {
            clientName: orderDetails.clientName,
            subtotal: orderSubtotal,
            discount,
            tip: tipAmount,
            total: orderTotal,
            items: orderCart.length,
            customerId: orderDetails.customerId
        });

        try {
            // FIX BUG 3: Generate idempotency key to prevent duplicate submissions
            const idempotencyKey = `order-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

            const orderData = {
                ...orderDetails,
                items: orderCart,
                subtotal: orderSubtotal,
                discount, // FIX BUG 1: Include discount in order data
                total: orderTotal,
                userId: authHook.currentUser?.id || 'guest',
                customerId: orderDetails.customerId || null,
                tip: tipAmount,
                idempotencyKey, // Add idempotency key
            };

            console.log('📡 Sending order to API...', orderData);

            // Create order in database
            const response = await fetch('/api/orders', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Idempotency-Key': idempotencyKey // Send in header too
                },
                body: JSON.stringify(orderData),
            });

            console.log('📡 Server response status:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ Server error:', response.status, errorText);
                // Restore cart if order failed
                orderCart.forEach(item => cartHook.addToCart(item));
                alert(`❌ Error al guardar la orden: ${response.status} - ${errorText}`);
                throw new Error(`Failed to create order: ${response.status} - ${errorText}`);
            }

            const newOrder = await response.json();
            console.log('✅ Order saved successfully:', newOrder.id);

            // Update local state and cache (no refetch needed - we have the new order)
            ordersHook.pushOrder(newOrder);

            // 🚀 PERF FIX: Update stock in background (non-blocking)
            // This was causing ~100-500ms delay after order creation
            const stockUpdates = orderCart.map(item => ({
                id: item.id,
                quantity: item.quantity
            }));
            productsHook.updateStockForSale(stockUpdates).catch(err =>
                console.error('Background stock update failed:', err)
            );

            // Return success info instead of blocking alert
            console.log(`✅ Venta guardada: ${orderDetails.clientName} - $${orderTotal.toFixed(2)}`);
        } catch (error) {
            console.error("❌ Error creating order:", error);
            alert(`❌ ERROR: La venta NO se guardó. ${error.message || error}`);
            throw error; // Re-throw so caller knows it failed
        }
    };

    // 🔄 Refetch All Data - complete refresh of all app data
    const refetchAll = async () => {
        try {
            console.log('🔄 Refetching all data...');

            const [productsData, ordersData, expensesData, coworkingData, cashData, usersData, customersData, withdrawalsData] = await Promise.all([
                fetch('/api/products').then(r => r.ok ? r.json() : null),
                fetch('/api/orders').then(r => r.ok ? r.json() : null),
                fetch('/api/expenses').then(r => r.ok ? r.json() : null),
                fetch('/api/coworking-sessions').then(r => r.ok ? r.json() : null),
                fetch('/api/cash-sessions?limit=100').then(r => r.ok ? r.json() : null),
                fetch('/api/users').then(r => r.ok ? r.json() : null),
                fetch('/api/customers').then(r => r.ok ? r.json() : null),
                fetch('/api/cash-withdrawals').then(r => r.ok ? r.json() : null)
            ]);

            if (productsData) {
                productsHook.hydrateProducts(productsData);
                sessionCache.set(CACHE_KEYS.PRODUCTS, productsData);
                offlineStorage.saveAll(STORES.PRODUCTS, productsData).catch(() => {});
            }
            if (ordersData) {
                ordersHook.hydrateOrders(ordersData);
                sessionCache.set(CACHE_KEYS.ORDERS, ordersData);
                offlineStorage.saveAll(STORES.ORDERS, ordersData).catch(() => {});
            }
            if (expensesData) {
                expensesHook.hydrateExpenses(expensesData);
                sessionCache.set(CACHE_KEYS.EXPENSES, expensesData);
                offlineStorage.saveAll(STORES.EXPENSES, expensesData).catch(() => {});
            }
            if (coworkingData) {
                console.log(`🏢 Coworking sessions refetched: ${coworkingData.length} sessions`);
                coworkingHook.hydrateCoworkingSessions(coworkingData);
                sessionCache.set(CACHE_KEYS.COWORKING_SESSIONS, coworkingData);
            }
            if (cashData) {
                const mappedSessions: CashSession[] = cashData.map((session: any) => ({
                    id: session.id,
                    startDate: session.startTime,
                    endDate: session.endTime,
                    startAmount: session.startAmount,
                    endAmount: session.endAmount,
                    status: session.status === 'active' ? 'open' : 'closed',
                    totalSales: session.totalSales,
                    totalExpenses: session.totalExpenses,
                    expectedCash: session.expectedCash,
                    difference: session.difference
                }));
                cashSessionsHook.hydrateCashSessions(mappedSessions);
                sessionCache.set(CACHE_KEYS.CASH_SESSIONS, mappedSessions);
                offlineStorage.saveAll(STORES.CASH_SESSIONS, mappedSessions).catch(() => {});
            }
            if (usersData) {
                authHook.hydrateUsers(usersData);
                sessionCache.set(CACHE_KEYS.USERS, usersData);
            }
            if (customersData) {
                customersHook.hydrateCustomers(customersData);
                sessionCache.set(CACHE_KEYS.CUSTOMERS, customersData);
                offlineStorage.saveAll(STORES.CUSTOMERS, customersData).catch(() => {});
            }
            if (withdrawalsData) {
                cashWithdrawalsHook.hydrateCashWithdrawals(withdrawalsData);
                sessionCache.set(CACHE_KEYS.CASH_WITHDRAWALS, withdrawalsData);
            }

            console.log('✅ All data refetched successfully');
        } catch (error) {
            console.error('❌ Error refetching data:', error);
        }
    };

    // Expense Functions (updated for API)
    const addExpense = async (expense: Omit<Expense, 'id'>) => {
        try {
            // Si el pago es desde efectivo de caja, verificar que hay sesión abierta
            if (expense.paymentSource === 'efectivo_caja') {
                const openSession = cashSessionsHook.cashSessions.find(s => s.status === 'open');
                if (!openSession) {
                    alert('No hay una sesión de caja abierta. No se puede usar efectivo de caja.');
                    throw new Error('No open cash session');
                }

                // Crear retiro de caja asociado al gasto
                await cashWithdrawalsHook.addCashWithdrawal(
                    openSession.id,
                    expense.amount,
                    `Gasto: ${expense.description} (${expense.category})`,
                    authHook.currentUser?.id
                );
            }

            await expensesHook.createExpense(expense, authHook.currentUser?.id);
        } catch (error) {
            console.error("Error adding expense:", error);
            throw error;
        }
    };

    // finishCoworkingSession spans coworking-sessions + products (stock) + orders
    // (creates the closing order) - see hooks/useCoworkingSessions.ts for why the
    // simpler coworking operations don't need this composition.
    const finishCoworkingSession = async (sessionId: string, paymentMethod: 'Efectivo' | 'Tarjeta') => {
        try {
            const session = coworkingHook.coworkingSessions.find(s => s.id === sessionId);
            if (!session || session.status === 'closed') {
                throw new Error('Session not found or already finished');
            }

            // Decrease stock for extras via API
            const stockUpdates = session.consumedExtras.map(item => ({ id: item.id, quantity: item.quantity }));
            await productsHook.updateStockForSale(stockUpdates);

            // Create Order logic with correct coworking billing
            const endTime = new Date();
            const startTime = new Date(session.startTime);
            const durationMs = endTime.getTime() - startTime.getTime();
            const durationMinutes = Math.max(0, Math.ceil(durationMs / (1000 * 60)));
            const durationHours = durationMinutes / 60;

            let baseCost = 0;
            if (durationMinutes > 0) {
                if (durationHours >= 4) {
                    // 4+ horas = día completo
                    baseCost = 225;
                } else if (durationMinutes <= 60) {
                    // Primera hora
                    baseCost = 72;
                } else {
                    // Después de la primera hora: $36 por cada bloque de 30 minutos
                    const extraMinutes = durationMinutes - 60;
                    const halfHourBlocks = Math.ceil(extraMinutes / 30);
                    baseCost = 72 + (halfHourBlocks * 36);
                }
            }

            // Separar items de cafetería (incluidos) vs otros (se cobran aparte)
            const cafeItems = session.consumedExtras.filter(item => item.category === 'Cafetería');
            const chargeableItems = session.consumedExtras.filter(item => item.category !== 'Cafetería');

            // Crear descripción del servicio
            const hours = Math.floor(durationMinutes / 60);
            const minutes = durationMinutes % 60;
            let serviceDescription = `Tiempo: ${hours}h ${minutes}m`;
            if (durationHours >= 4) {
                serviceDescription += ` (Día completo)`;
            }
            if (cafeItems.length > 0) {
                serviceDescription += ` | Café incluido: ${cafeItems.map(item => `${item.name} x${item.quantity}`).join(', ')}`;
            }

            const coworkingServiceItem: CartItem = {
                id: 'COWORK_SERVICE', name: `Servicio Coworking`, price: baseCost, cost: 0,
                quantity: 1, stock: Infinity, description: serviceDescription,
                imageUrl: '', category: 'Cafetería',
            };

            // Convert cafe items to $0 price (complimentary) but keep cost for tracking
            const cafeItemsWithZeroPrice = cafeItems.map(item => ({
                ...item,
                price: 0 // Complimentary for customers, but cost still tracked
            }));

            // Include ALL items: service + cafe items (at $0) + chargeable items
            const allOrderItems = [coworkingServiceItem, ...cafeItemsWithZeroPrice, ...chargeableItems];
            const subtotal = allOrderItems.reduce((acc, item) => acc + item.price * item.quantity, 0);
            const total = subtotal;

            // Cost will be automatically calculated from allOrderItems by the server
            const totalCost = session.consumedExtras.reduce((acc, item) => acc + (item.cost * item.quantity), 0);

            const newOrder: Order = {
                id: `ORD-${Date.now()}`, date: endTime.toISOString(), items: allOrderItems,
                subtotal, total, totalCost, clientName: session.clientName,
                serviceType: 'Mesa', paymentMethod,
            };

            // CRITICAL FIX: Persist coworking order to database for profit tracking
            console.log('💾 Attempting to save coworking order to database...', {
                clientName: session.clientName,
                total,
                items: allOrderItems.length
            });

            try {
                const response = await fetch('/api/orders', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        clientName: session.clientName,
                        serviceType: 'Mesa',
                        paymentMethod,
                        items: allOrderItems,
                        subtotal,
                        total,
                        userId: authHook.currentUser?.id || 'coworking-system'
                    })
                });

                console.log('📡 Server response status:', response.status);

                if (response.ok) {
                    const createdOrder = await response.json();
                    ordersHook.pushOrder(createdOrder);
                    console.log('✅ Coworking order successfully saved to database:', createdOrder.id);
                    alert(`✅ Sesión de coworking guardada: ${session.clientName} - $${total.toFixed(2)}`);
                } else {
                    const errorText = await response.text();
                    console.error('❌ Failed to save coworking order. Status:', response.status, 'Error:', errorText);
                    alert(`⚠️ Error al guardar la orden de coworking: ${response.status} - ${errorText}`);
                    // Fallback to local state only
                    ordersHook.pushOrder(newOrder);
                }
            } catch (error) {
                console.error('❌ Error saving coworking order:', error);
                alert(`⚠️ Error al guardar la orden de coworking: ${error.message}`);
                // Fallback to local state only
                ordersHook.pushOrder(newOrder);
            }

            // Update session with calculated total, duration, and payment method for reporting
            await coworkingHook.updateCoworkingSession(sessionId, {
                endTime: endTime.toISOString(),
                status: 'finished',
                total: total,
                duration: durationMinutes,
                paymentMethod: paymentMethod
            });

            // Force refresh to ensure consistency across devices
            await refetchAll();
        } catch (error) {
            console.error('Error finishing coworking session:', error);
            // Still try to refresh to show current state
            await refetchAll();
            throw error; // Re-throw so caller can handle
        }
    };

    // closeCashSession spans cash-sessions + orders + expenses + coworking-sessions
    // + cash-withdrawals to compute the closing summary - see
    // hooks/useCashSessions.ts for why that calculation isn't in the hook itself.
    const closeCashSession = async (endAmount: number) => {
        const currentSession = cashSessionsHook.cashSessions.find(s => s.status === 'open');
        if (!currentSession) {
            alert("No hay una sesión de caja abierta para cerrar.");
            return;
        }

        try {
            // Calculate totals from current session data
            const sessionOrders = ordersHook.orders.filter(o => new Date(o.date) >= new Date(currentSession.startDate));
            const sessionExpenses = expensesHook.expenses.filter(e => new Date(e.date) >= new Date(currentSession.startDate));
            const sessionCoworking = coworkingHook.coworkingSessions.filter(s =>
                s.status === 'closed' && s.endTime && new Date(s.endTime) >= new Date(currentSession.startDate)
            );
            const sessionWithdrawals = cashWithdrawalsHook.cashWithdrawals.filter(w => w.cash_session_id === currentSession.id);

            const ordersSales = sessionOrders.reduce((sum, order) => sum + order.total, 0);
            const coworkingSales = sessionCoworking.reduce((sum, session) => sum + ((session as any).total || 0), 0);
            const totalSales = ordersSales + coworkingSales;
            const totalExpenses = sessionExpenses.reduce((sum, expense) => sum + expense.amount, 0);
            const totalWithdrawals = sessionWithdrawals.reduce((sum, w) => sum + w.amount, 0);

            const ordersCashSales = sessionOrders.filter(o => o.paymentMethod === 'Efectivo').reduce((sum, o) => sum + o.total, 0);
            const coworkingCashSales = sessionCoworking.filter(s => (s as any).paymentMethod === 'Efectivo').reduce((sum, s) => sum + ((s as any).total || 0), 0);
            const cashSales = ordersCashSales + coworkingCashSales;

            const expectedCash = currentSession.startAmount + cashSales - totalExpenses - totalWithdrawals;
            const difference = endAmount - expectedCash;

            const updateData = {
                endAmount,
                endTime: new Date().toISOString(),
                totalSales,
                totalExpenses,
                expectedCash,
                difference,
                status: 'closed'
            };

            await cashSessionsHook.closeCashSessionRequest(currentSession.id, updateData);
        } catch (error) {
            console.error("Error closing cash session:", error);
            alert("Error al cerrar la sesión de caja");
        }
    };

    // Thin wrappers so the public interface stays `(cashSessionId, amount, description)` /
    // `(startAmount)`, with currentUser injected here rather than reaching into
    // useAuthUsers from inside useCashWithdrawals/useCashSessions.
    const addCashWithdrawal = (cashSessionId: string, amount: number, description: string) =>
        cashWithdrawalsHook.addCashWithdrawal(cashSessionId, amount, description, authHook.currentUser?.id);

    const startCashSession = (startAmount: number) =>
        cashSessionsHook.startCashSession(startAmount, authHook.currentUser?.id);

    return (
        <AppContext.Provider value={{
            isInitializing,
            users: authHook.users, currentUser: authHook.currentUser,
            login: authHook.login, logout: authHook.logout, register: authHook.register,
            approveUser: authHook.approveUser, deleteUser: authHook.deleteUser,
            products: productsHook.products,
            addProduct: productsHook.addProduct, updateProduct: productsHook.updateProduct,
            deleteProduct: productsHook.deleteProduct, importProducts: productsHook.importProducts,
            cart: cartHook.cart, addToCart: cartHook.addToCart, removeFromCart: cartHook.removeFromCart,
            updateCartQuantity: cartHook.updateCartQuantity, clearCart: cartHook.clearCart,
            cartSubtotal: cartHook.cartSubtotal, cartTotal: cartHook.cartTotal,
            orders: ordersHook.orders, createOrder, deleteOrder: ordersHook.deleteOrder,
            refetchOrders: ordersHook.refetchOrders, refetchAll,
            expenses: expensesHook.expenses, addExpense,
            updateExpense: expensesHook.updateExpense, deleteExpense: expensesHook.deleteExpense,
            coworkingSessions: coworkingHook.coworkingSessions,
            startCoworkingSession: coworkingHook.startCoworkingSession,
            updateCoworkingSession: coworkingHook.updateCoworkingSession,
            finishCoworkingSession,
            cancelCoworkingSession: coworkingHook.cancelCoworkingSession,
            deleteCoworkingSession: coworkingHook.deleteCoworkingSession,
            cashSessions: cashSessionsHook.cashSessions, cashWithdrawals: cashWithdrawalsHook.cashWithdrawals,
            startCashSession, closeCashSession,
            addCashWithdrawal, deleteCashWithdrawal: cashWithdrawalsHook.deleteCashWithdrawal,
            customers: customersHook.customers, addCustomer: customersHook.addCustomer,
            updateCustomer: customersHook.updateCustomer, deleteCustomer: customersHook.deleteCustomer,
            addCustomerCredit: customersHook.addCustomerCredit,
        }}>
            {children}
        </AppContext.Provider>
    );
};

export const useAppContext = () => {
    const context = useContext(AppContext);
    if (context === undefined) {
        throw new Error('useAppContext must be used within an AppContextProvider');
    }
    return context;
};
