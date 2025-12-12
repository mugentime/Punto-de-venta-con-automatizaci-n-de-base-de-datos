import React, { createContext, useContext, useState, ReactNode, useEffect, useRef, useCallback, useMemo } from 'react';
import useLocalStorage from '../hooks/useLocalStorage';
import { sessionCache, CACHE_KEYS } from '../utils/sessionCache';
import { dedupedFetch, invalidateCache, shouldRefreshOnVisibility, getCachedData } from '../utils/apiCache';
import offlineStorage, { STORES } from '../utils/offlineStorage';
import type { Product, CartItem, Order, Expense, CoworkingSession, CashSession, User, Customer, CustomerCredit, CashWithdrawal } from '../types';

const initialAdmin: User = {
    id: 'admin-001',
    username: 'Admin1',
    email: 'je2alvarela@gmail.com',
    password: '1357',
    role: 'admin',
    status: 'approved',
};

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

export const AppContextProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    // --- STATE MANAGEMENT ---

    // PWA initialization state - prevents showing stale/empty data
    const [isInitializing, setIsInitializing] = useState(true);

    // All State (now fetched from backend)
    const [users, setUsers] = useState<User[]>([]);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [products, setProducts] = useState<Product[]>([]);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [orders, setOrders] = useState<Order[]>([]);
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [coworkingSessions, setCoworkingSessions] = useState<CoworkingSession[]>([]);
    const [cashSessions, setCashSessions] = useState<CashSession[]>([]);
    const [cashWithdrawals, setCashWithdrawals] = useState<CashWithdrawal[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);

    // --- EFFECTS ---

    // Restore user session from localStorage on app load
    useEffect(() => {
        const storedUser = localStorage.getItem('currentUser');
        if (storedUser) {
            try {
                const user = JSON.parse(storedUser);
                setCurrentUser(user);
            } catch (error) {
                console.error('Failed to restore user session:', error);
                localStorage.removeItem('currentUser');
            }
        }
    }, []);

    // Track if initial load from cache has been done
    const initialLoadDone = useRef(false);
    const isFetching = useRef(false); // Prevent concurrent fetches

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
                        setProducts(cachedProducts);
                        console.log(`📦 Products from cache: ${cachedProducts.length} items`);
                    }
                    if (cachedOrders && cachedOrders.length > 0) {
                        setOrders(cachedOrders);
                        console.log(`📋 Orders from cache: ${cachedOrders.length} orders`);
                    }
                    if (cachedExpenses && cachedExpenses.length > 0) setExpenses(cachedExpenses);
                    if (cachedCoworking && cachedCoworking.length > 0) setCoworkingSessions(cachedCoworking);
                    if (cachedCashSessions && cachedCashSessions.length > 0) {
                        setCashSessions(cachedCashSessions);
                        console.log(`💰 Cash sessions from cache: ${cachedCashSessions.length} sessions`);
                    }
                    if (cachedUsers && cachedUsers.length > 0) setUsers(cachedUsers);
                    if (cachedCustomers && cachedCustomers.length > 0) setCustomers(cachedCustomers);
                    if (cachedWithdrawals && cachedWithdrawals.length > 0) setCashWithdrawals(cachedWithdrawals);

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
                        setProducts(productsData);
                        sessionCache.set(CACHE_KEYS.PRODUCTS, productsData);
                        offlineStorage.saveAll(STORES.PRODUCTS, productsData).catch(() => {});
                    }
                    if (ordersData) {
                        setOrders(ordersData);
                        sessionCache.set(CACHE_KEYS.ORDERS, ordersData);
                        offlineStorage.saveAll(STORES.ORDERS, ordersData).catch(() => {});
                    }
                    if (expensesData) {
                        setExpenses(expensesData);
                        sessionCache.set(CACHE_KEYS.EXPENSES, expensesData);
                        offlineStorage.saveAll(STORES.EXPENSES, expensesData).catch(() => {});
                    }
                    if (coworkingData) {
                        setCoworkingSessions(coworkingData);
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
                        setCashSessions(mappedSessions);
                        sessionCache.set(CACHE_KEYS.CASH_SESSIONS, mappedSessions);
                        offlineStorage.saveAll(STORES.CASH_SESSIONS, mappedSessions).catch(() => {});
                    }
                    // FIX: Customers now included in background refresh for instant PWA load
                    if (customersData) {
                        setCustomers(customersData);
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
                    dedupedFetch<User[]>('/api/users').catch(() => [initialAdmin]),
                    dedupedFetch<Customer[]>('/api/customers').catch(() => null),
                    dedupedFetch<CashWithdrawal[]>('/api/cash-withdrawals').catch(() => null)
                ]);

                // Update state and caches in parallel
                if (productsData) {
                    console.log(`${logPrefix} 📦 Products loaded: ${productsData.length} items`);
                    setProducts(productsData);
                    sessionCache.set(CACHE_KEYS.PRODUCTS, productsData);
                    offlineStorage.saveAll(STORES.PRODUCTS, productsData).catch(console.error);
                }

                if (ordersData) {
                    console.log(`${logPrefix} 📋 Orders loaded: ${ordersData.length} orders`);
                    setOrders(ordersData);
                    sessionCache.set(CACHE_KEYS.ORDERS, ordersData);
                    offlineStorage.saveAll(STORES.ORDERS, ordersData).catch(console.error);
                }

                if (expensesData) {
                    setExpenses(expensesData);
                    sessionCache.set(CACHE_KEYS.EXPENSES, expensesData);
                    offlineStorage.saveAll(STORES.EXPENSES, expensesData).catch(console.error);
                }

                if (coworkingData) {
                    setCoworkingSessions(coworkingData);
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
                    setCashSessions(mappedSessions);
                    sessionCache.set(CACHE_KEYS.CASH_SESSIONS, mappedSessions);
                    offlineStorage.saveAll(STORES.CASH_SESSIONS, mappedSessions).catch(console.error);
                }

                if (usersData) {
                    setUsers(usersData);
                    sessionCache.set(CACHE_KEYS.USERS, usersData);
                }

                if (customersData) {
                    console.log(`${logPrefix} 👥 Customers loaded: ${customersData.length} customers`);
                    setCustomers(customersData);
                    sessionCache.set(CACHE_KEYS.CUSTOMERS, customersData);
                    // FIX: Persist customers to IndexedDB for instant PWA reload
                    offlineStorage.saveAll(STORES.CUSTOMERS, customersData).catch(console.error);
                }

                if (withdrawalsData) {
                    setCashWithdrawals(withdrawalsData);
                    sessionCache.set(CACHE_KEYS.CASH_WITHDRAWALS, withdrawalsData);
                }

                console.log(`${logPrefix} ✅ Data fetch complete (parallel)`);
            } catch (error) {
                console.error("Failed to fetch data:", error);
                setUsers([initialAdmin]);
            }
        };

        loadFromCacheOrFetch();
    }, []);

    // 🔄 MINIMAL POLLING: Only poll when there are ACTIVE coworking sessions
    // No polling = no API calls = cheap & fast
    // FIX: Memoize active count to prevent infinite loop from .filter() creating new array each render
    const activeSessionCount = useMemo(
        () => coworkingSessions.filter(s => s.status === 'active').length,
        [coworkingSessions]
    );

    useEffect(() => {
        // NO POLLING if no active sessions - saves API calls
        if (activeSessionCount === 0) {
            console.log('⏱️ No active coworking sessions - polling disabled');
            return;
        }

        console.log('⏱️ Active coworking session detected - polling every 10s');

        const pollCoworkingSessions = async () => {
            if (document.visibilityState !== 'visible' || !navigator.onLine) return;

            try {
                const sessions = await dedupedFetch<CoworkingSession[]>('/api/coworking-sessions', {}, true);
                setCoworkingSessions(sessions);
                sessionCache.set(CACHE_KEYS.COWORKING_SESSIONS, sessions);
            } catch (error) {
                console.error('Failed to poll coworking sessions:', error);
            }
        };

        // Poll every 10 seconds ONLY when active sessions exist
        const interval = setInterval(pollCoworkingSessions, 10000);

        return () => clearInterval(interval);
    }, [activeSessionCount]); // Stable memoized value - no infinite loop


    // --- FUNCTIONS ---

    // Auth Functions (updated for API)
    const login = async (username: string, password?: string): Promise<void> => {
        try {
            // Call the login API endpoint which validates credentials server-side
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Error al iniciar sesión');
            }

            const user = await response.json();

            // Set current user and persist to localStorage
            setCurrentUser(user);
            localStorage.setItem('currentUser', JSON.stringify(user));
        } catch (error) {
            throw error;
        }
    };

    const logout = () => {
        setCurrentUser(null);
        // Clear from localStorage
        localStorage.removeItem('currentUser');
    };

    const register = async (userDetails: Omit<User, 'id' | 'role' | 'status'>): Promise<void> => {
        // Check for duplicates in local state first (quick validation)
        if (users.some(u => u.username.toLowerCase() === userDetails.username.toLowerCase())) {
            throw new Error('El nombre de usuario ya existe.');
        }
        if (users.some(u => u.email.toLowerCase() === userDetails.email.toLowerCase())) {
            throw new Error('El correo electrónico ya está en uso.');
        }

        try {
            // Create user via API to persist to database
            const response = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...userDetails,
                    role: 'employee',
                    status: 'pending'
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to create user');
            }

            const newUser = await response.json();
            setUsers(prev => [...prev, newUser]);
        } catch (error) {
            console.error("Error registering user:", error);
            throw error;
        }
    };

    const approveUser = async (userId: string) => {
        try {
            const user = users.find(u => u.id === userId);
            if (!user) {
                alert('Usuario no encontrado');
                throw new Error('User not found');
            }

            const response = await fetch(`/api/users/${userId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: user.username,
                    email: user.email,
                    role: user.role,
                    status: 'approved'
                }),
            });

            if (!response.ok) {
                alert('Error al aprobar el usuario. Por favor intente de nuevo.');
                throw new Error('Failed to approve user');
            }

            const updatedUser = await response.json();
            setUsers(prev => prev.map(u => u.id === userId ? updatedUser : u));
            alert(`✅ Usuario ${user.username} aprobado exitosamente`);
        } catch (error) {
            console.error("Error approving user:", error);
            throw error;
        }
    };

    const deleteUser = async (userId: string) => {
        try {
            const response = await fetch(`/api/users/${userId}`, {
                method: 'DELETE',
            });

            if (!response.ok) throw new Error('Failed to delete user');

            setUsers(prev => prev.filter(u => u.id !== userId));
        } catch (error) {
            console.error("Error deleting user:", error);
            throw error;
        }
    };

    // Product Functions (rewritten to use API)
    const addProduct = async (product: Omit<Product, 'id'>) => {
        try {
            const response = await fetch('/api/products', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(product),
            });
            if (!response.ok) throw new Error('Failed to create product');
            const newProduct = await response.json();
            setProducts(prev => {
                const updated = [...prev, newProduct];
                sessionCache.set(CACHE_KEYS.PRODUCTS, updated);
                return updated;
            });
        } catch (error) {
            console.error("Error adding product:", error);
        }
    };

    const updateProduct = async (updatedProduct: Product) => {
        try {
            const response = await fetch(`/api/products/${updatedProduct.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedProduct),
            });
            if (!response.ok) throw new Error('Failed to update product');
            const returnedProduct = await response.json();
            setProducts(prev => {
                const updated = prev.map(p => p.id === returnedProduct.id ? returnedProduct : p);
                sessionCache.set(CACHE_KEYS.PRODUCTS, updated);
                return updated;
            });
        } catch (error) {
            console.error("Error updating product:", error);
        }
    };

    const deleteProduct = async (productId: string) => {
        try {
            const response = await fetch(`/api/products/${productId}`, {
                method: 'DELETE',
            });
            if (!response.ok) throw new Error('Failed to delete product');
            setProducts(prev => {
                const updated = prev.filter(p => p.id !== productId);
                sessionCache.set(CACHE_KEYS.PRODUCTS, updated);
                return updated;
            });
        } catch (error) {
            console.error("Error deleting product:", error);
        }
    };

    const importProducts = async (importedProducts: Omit<Product, 'id'>[]) => {
        try {
            const response = await fetch('/api/products/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(importedProducts),
            });
            if (!response.ok) throw new Error('Failed to import products');
            const fullProductList = await response.json();
            setProducts(fullProductList);
            sessionCache.set(CACHE_KEYS.PRODUCTS, fullProductList);
        } catch (error) {
            console.error("Error importing products:", error);
        }
    };

    // Cart Functions (no changes to cart logic itself)
    const addToCart = (product: Product) => {
        setCart(prev => {
            const existingItem = prev.find(item => item.id === product.id);
            if (existingItem) {
                return prev.map(item =>
                    item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
                );
            }
            return [...prev, { ...product, quantity: 1 }];
        });
    };
    
    const removeFromCart = (productId: string) => {
        setCart(prev => prev.filter(item => item.id !== productId));
    };
    
    const updateCartQuantity = (productId: string, quantity: number) => {
        if (quantity <= 0) {
            removeFromCart(productId);
            return;
        }
        setCart(prev => prev.map(item => item.id === productId ? { ...item, quantity } : item));
    };

    const clearCart = () => {
        setCart([]);
    };
    
    // Combined Order/Stock Update Function
    const updateStockForSale = async (items: { id: string, quantity: number }[]) => {
        if (items.length === 0) return;
        try {
            await fetch('/api/products/update-stock', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items }),
            });
             // Optimistically update frontend state
            setProducts(prevProducts => {
                const updatedProducts = [...prevProducts];
                items.forEach(itemToUpdate => {
                    const productIndex = updatedProducts.findIndex(p => p.id === itemToUpdate.id);
                    if (productIndex > -1) {
                        updatedProducts[productIndex].stock -= itemToUpdate.quantity;
                    }
                });
                return updatedProducts;
            });
        } catch (error) {
            console.error("Failed to update stock:", error);
            // Here you might want to refetch products to ensure consistency
        }
    }

    // Order Function (updated for API)
    const createOrder = async (orderDetails: { clientName: string; serviceType: 'Mesa' | 'Para llevar'; paymentMethod: 'Efectivo' | 'Tarjeta' | 'Crédito'; customerId?: string; tip?: number; }) => {
        if(cart.length === 0) return;

        // FIX BUG 3: Clear cart IMMEDIATELY to prevent duplicate orders during async operations
        const orderCart = [...cart];
        const orderSubtotal = cartSubtotal;

        // FIX BUG 1: Calculate discount from customer
        let discount = 0;
        if (orderDetails.customerId) {
            const customer = customers.find(c => c.id === orderDetails.customerId);
            if (customer && customer.discountPercentage > 0) {
                discount = orderSubtotal * (customer.discountPercentage / 100);
                console.log(`💰 Applying ${customer.discountPercentage}% discount for ${customer.name}: -$${discount.toFixed(2)}`);
            }
        }

        const tipAmount = orderDetails.tip || 0;
        const orderTotal = orderSubtotal - discount + tipAmount;

        clearCart();

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
                userId: currentUser?.id || 'guest',
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
                orderCart.forEach(item => addToCart(item));
                alert(`❌ Error al guardar la orden: ${response.status} - ${errorText}`);
                throw new Error(`Failed to create order: ${response.status} - ${errorText}`);
            }

            const newOrder = await response.json();
            console.log('✅ Order saved successfully:', newOrder.id);

            // Update local state and cache (no refetch needed - we have the new order)
            setOrders(prev => {
                const updated = [newOrder, ...prev];
                sessionCache.set(CACHE_KEYS.ORDERS, updated);
                return updated;
            });

            // 🚀 PERF FIX: Update stock in background (non-blocking)
            // This was causing ~100-500ms delay after order creation
            const stockUpdates = orderCart.map(item => ({
                id: item.id,
                quantity: item.quantity
            }));
            updateStockForSale(stockUpdates).catch(err =>
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

    const cartSubtotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
    const cartTotal = cartSubtotal;

    // Delete Order Function
    const deleteOrder = async (orderId: string) => {
        try {
            const response = await fetch(`/api/orders/${orderId}`, {
                method: 'DELETE',
            });

            if (!response.ok) throw new Error('Failed to delete order');

            // Update local state and cache
            setOrders(prev => {
                const updated = prev.filter(o => o.id !== orderId);
                sessionCache.set(CACHE_KEYS.ORDERS, updated);
                return updated;
            });

            console.log('✅ Order deleted successfully:', orderId);
        } catch (error) {
            console.error("Error deleting order:", error);
            alert("Error al eliminar la orden");
            throw error;
        }
    };

    // 🔄 OPTION A: Refetch Orders Function - allows manual refresh
    const refetchOrders = async () => {
        try {
            console.log('🔄 Refetching orders...');
            const ordersResponse = await fetch('/api/orders');
            if (ordersResponse.ok) {
                const ordersData: Order[] = await ordersResponse.json();
                console.log('✅ Orders refetched:', ordersData.length, 'orders');
                setOrders(ordersData);
                sessionCache.set(CACHE_KEYS.ORDERS, ordersData);
            } else {
                console.error('❌ Failed to refetch orders:', await ordersResponse.text());
            }
        } catch (error) {
            console.error('❌ Error refetching orders:', error);
        }
    };

    // Expense Functions (updated for API)
    const addExpense = async (expense: Omit<Expense, 'id'>) => {
        try {
            // Si el pago es desde efectivo de caja, verificar que hay sesión abierta
            if (expense.paymentSource === 'efectivo_caja') {
                const openSession = cashSessions.find(s => s.status === 'open');
                if (!openSession) {
                    alert('No hay una sesión de caja abierta. No se puede usar efectivo de caja.');
                    throw new Error('No open cash session');
                }

                // Crear retiro de caja asociado al gasto
                await addCashWithdrawal(
                    openSession.id,
                    expense.amount,
                    `Gasto: ${expense.description} (${expense.category})`
                );
            }

            const response = await fetch('/api/expenses', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...expense, userId: currentUser?.id }),
            });
            if (!response.ok) throw new Error('Failed to create expense');
            const newExpense = await response.json();
            setExpenses(prev => {
                const updated = [newExpense, ...prev];
                sessionCache.set(CACHE_KEYS.EXPENSES, updated);
                return updated;
            });

            const sourceLabel = expense.paymentSource === 'efectivo_caja' ? 'Efectivo de Caja' : 'Transferencia';
            alert(`Gasto registrado: $${expense.amount.toFixed(2)} (${sourceLabel})`);
        } catch (error) {
            console.error("Error adding expense:", error);
            throw error;
        }
    };
    const updateExpense = async (updatedExpense: Expense) => {
        try {
            const response = await fetch(`/api/expenses/${updatedExpense.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedExpense),
            });
            if (!response.ok) throw new Error('Failed to update expense');
            const returnedExpense = await response.json();
            setExpenses(prev => {
                const updated = prev.map(e => e.id === returnedExpense.id ? returnedExpense : e);
                sessionCache.set(CACHE_KEYS.EXPENSES, updated);
                return updated;
            });
        } catch (error) {
            console.error("Error updating expense:", error);
        }
    };
    const deleteExpense = async (expenseId: string) => {
        try {
            const response = await fetch(`/api/expenses/${expenseId}`, {
                method: 'DELETE',
            });
            if (!response.ok) throw new Error('Failed to delete expense');
            setExpenses(prev => {
                const updated = prev.filter(e => e.id !== expenseId);
                sessionCache.set(CACHE_KEYS.EXPENSES, updated);
                return updated;
            });
        } catch (error) {
            console.error("Error deleting expense:", error);
        }
    };
    
    // Coworking Functions (updated for API)
    const startCoworkingSession = async (clientName: string) => {
        try {
            const sessionData = {
                clientName: clientName || 'Cliente',
                startTime: new Date().toISOString(),
                hourlyRate: 50,
            };

            const response = await fetch('/api/coworking-sessions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(sessionData),
            });

            if (!response.ok) throw new Error('Failed to create coworking session');
            const newSession = await response.json();
            setCoworkingSessions(prev => {
                const updated = [newSession, ...prev];
                sessionCache.set(CACHE_KEYS.COWORKING_SESSIONS, updated);
                return updated;
            });
        } catch (error) {
            console.error("Error starting coworking session:", error);
        }
    };

    const updateCoworkingSession = async (sessionId: string, updates: Partial<CoworkingSession>) => {
        try {
            const response = await fetch(`/api/coworking-sessions/${sessionId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates),
            });

            if (!response.ok) throw new Error('Failed to update coworking session');
            const updatedSession = await response.json();
            setCoworkingSessions(prev => {
                const updated = prev.map(s => s.id === sessionId ? updatedSession : s);
                sessionCache.set(CACHE_KEYS.COWORKING_SESSIONS, updated);
                return updated;
            });
        } catch (error) {
            console.error("Error updating coworking session:", error);
        }
    };
    
    const finishCoworkingSession = async (sessionId: string, paymentMethod: 'Efectivo' | 'Tarjeta') => {
        const session = coworkingSessions.find(s => s.id === sessionId);
        if (!session || session.status === 'finished') return;

        // Decrease stock for extras via API
        const stockUpdates = session.consumedExtras.map(item => ({ id: item.id, quantity: item.quantity }));
        await updateStockForSale(stockUpdates);
        
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
                baseCost = 180;
            } else if (durationMinutes <= 60) {
                // Primera hora
                baseCost = 58;
            } else {
                // Después de la primera hora: $29 por cada bloque de 30 minutos
                const extraMinutes = durationMinutes - 60;
                const halfHourBlocks = Math.ceil(extraMinutes / 30);
                baseCost = 58 + (halfHourBlocks * 29);
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
                    userId: currentUser?.id || 'coworking-system'
                })
            });

            console.log('📡 Server response status:', response.status);

            if (response.ok) {
                const createdOrder = await response.json();
                setOrders(prev => {
                    const updated = [createdOrder, ...prev];
                    sessionCache.set(CACHE_KEYS.ORDERS, updated);
                    return updated;
                });
                console.log('✅ Coworking order successfully saved to database:', createdOrder.id);
                alert(`✅ Sesión de coworking guardada: ${session.clientName} - $${total.toFixed(2)}`);
            } else {
                const errorText = await response.text();
                console.error('❌ Failed to save coworking order. Status:', response.status, 'Error:', errorText);
                alert(`⚠️ Error al guardar la orden de coworking: ${response.status} - ${errorText}`);
                // Fallback to local state only
                setOrders(prev => {
                    const updated = [newOrder, ...prev];
                    sessionCache.set(CACHE_KEYS.ORDERS, updated);
                    return updated;
                });
            }
        } catch (error) {
            console.error('❌ Error saving coworking order:', error);
            alert(`⚠️ Error al guardar la orden de coworking: ${error.message}`);
            // Fallback to local state only
            setOrders(prev => {
                const updated = [newOrder, ...prev];
                sessionCache.set(CACHE_KEYS.ORDERS, updated);
                return updated;
            });
        }

        // Update session with calculated total, duration, and payment method for reporting
        updateCoworkingSession(sessionId, {
            endTime: endTime.toISOString(),
            status: 'finished',
            total: total,
            duration: durationMinutes,
            paymentMethod: paymentMethod
        });
    };

    const cancelCoworkingSession = async (sessionId: string) => {
        try {
            console.log('🗑️ Attempting to cancel coworking session:', sessionId);
            const response = await fetch(`/api/coworking-sessions/${sessionId}`, {
                method: 'DELETE',
            });

            console.log('📡 Server response status:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ Failed to cancel session. Status:', response.status, 'Error:', errorText);
                throw new Error(`Failed to cancel coworking session: ${response.status} - ${errorText}`);
            }

            console.log('✅ Session cancelled successfully from database');
            setCoworkingSessions(prev => prev.filter(s => s.id !== sessionId));
            alert('✅ Sesión cancelada exitosamente');
        } catch (error) {
            console.error("❌ Error canceling coworking session:", error);
            alert(`❌ Error al cancelar la sesión: ${error.message || error}`);
            // DO NOT update local state if API fails - this ensures data consistency
            throw error;
        }
    };

    const deleteCoworkingSession = async (sessionId: string) => {
        try {
            const response = await fetch(`/api/coworking-sessions/${sessionId}`, {
                method: 'DELETE',
            });

            if (!response.ok) throw new Error('Failed to delete coworking session');
            setCoworkingSessions(prev => prev.filter(s => s.id !== sessionId));
        } catch (error) {
            console.error("Error deleting coworking session:", error);
            // Fallback to local state update if API fails
            setCoworkingSessions(prev => prev.filter(s => s.id !== sessionId));
        }
    };

    // Cash Session Functions (updated for API)
    const startCashSession = async (startAmount: number) => {
        const existingOpenSession = cashSessions.find(s => s.status === 'open');
        if (existingOpenSession) {
            alert("Ya hay una sesión de caja abierta.");
            return;
        }

        try {
            const sessionData = {
                startAmount,
                startTime: new Date().toISOString(),
                userId: currentUser?.id || 'guest'
            };

            const response = await fetch('/api/cash-sessions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(sessionData),
            });

            if (!response.ok) throw new Error('Failed to create cash session');
            const newSession = await response.json();

            // Map API response to frontend CashSession type
            const mappedSession: CashSession = {
                id: newSession.id,
                startDate: newSession.startTime,
                endDate: newSession.endTime,
                startAmount: newSession.startAmount,
                endAmount: newSession.endAmount,
                status: newSession.status === 'active' ? 'open' : 'closed',
                totalSales: newSession.totalSales || 0,
                totalExpenses: newSession.totalExpenses || 0,
                expectedCash: newSession.expectedCash || newSession.startAmount,
                difference: newSession.difference || 0
            };

            setCashSessions(prev => {
                const updated = [mappedSession, ...prev];
                sessionCache.set(CACHE_KEYS.CASH_SESSIONS, updated);
                return updated;
            });
        } catch (error) {
            console.error("Error starting cash session:", error);
            alert("Error al iniciar la sesión de caja");
        }
    };

    const closeCashSession = async (endAmount: number) => {
        const currentSession = cashSessions.find(s => s.status === 'open');
        if (!currentSession) {
            alert("No hay una sesión de caja abierta para cerrar.");
            return;
        }

        try {
            // Calculate totals from current session data
            const sessionOrders = orders.filter(o => new Date(o.date) >= new Date(currentSession.startDate));
            const sessionExpenses = expenses.filter(e => new Date(e.date) >= new Date(currentSession.startDate));
            const sessionCoworking = coworkingSessions.filter(s =>
                s.status === 'finished' && s.endTime && new Date(s.endTime) >= new Date(currentSession.startDate)
            );
            const sessionWithdrawals = cashWithdrawals.filter(w => w.cash_session_id === currentSession.id);

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

            const response = await fetch(`/api/cash-sessions/${currentSession.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updateData),
            });

            if (!response.ok) throw new Error('Failed to close cash session');
            const updatedSession = await response.json();

            // Map API response to frontend CashSession type
            const mappedSession: CashSession = {
                id: updatedSession.id,
                startDate: updatedSession.startTime,
                endDate: updatedSession.endTime,
                startAmount: updatedSession.startAmount,
                endAmount: updatedSession.endAmount,
                status: updatedSession.status === 'active' ? 'open' : 'closed',
                totalSales: updatedSession.totalSales,
                totalExpenses: updatedSession.totalExpenses,
                expectedCash: updatedSession.expectedCash,
                difference: updatedSession.difference
            };

            setCashSessions(prev => {
                const updated = prev.map(s => s.id === currentSession.id ? mappedSession : s);
                sessionCache.set(CACHE_KEYS.CASH_SESSIONS, updated);
                return updated;
            });
        } catch (error) {
            console.error("Error closing cash session:", error);
            alert("Error al cerrar la sesión de caja");
        }
    };

    // Customer Functions
    const addCustomer = async (customerData: Omit<Customer, 'id' | 'createdAt' | 'currentCredit'>) => {
        try {
            const response = await fetch('/api/customers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(customerData),
            });

            if (!response.ok) throw new Error('Failed to add customer');
            const newCustomer: Customer = await response.json();
            setCustomers(prev => [...prev, newCustomer]);
        } catch (error) {
            console.error("Error adding customer:", error);
            alert("Error al agregar el cliente");
        }
    };

    const updateCustomer = async (customer: Customer) => {
        try {
            const response = await fetch(`/api/customers/${customer.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(customer),
            });

            if (!response.ok) throw new Error('Failed to update customer');
            const updatedCustomer: Customer = await response.json();
            setCustomers(prev => prev.map(c => c.id === customer.id ? updatedCustomer : c));
        } catch (error) {
            console.error("Error updating customer:", error);
            alert("Error al actualizar el cliente");
        }
    };

    const deleteCustomer = async (customerId: string) => {
        try {
            const response = await fetch(`/api/customers/${customerId}`, {
                method: 'DELETE',
            });

            if (!response.ok) throw new Error('Failed to delete customer');
            setCustomers(prev => prev.filter(c => c.id !== customerId));
        } catch (error) {
            console.error("Error deleting customer:", error);
            alert("Error al eliminar el cliente");
        }
    };

    const addCustomerCredit = async (customerId: string, amount: number, type: 'charge' | 'payment', description: string) => {
        try {
            const response = await fetch(`/api/customers/${customerId}/credits`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount, type, description }),
            });

            if (!response.ok) throw new Error('Failed to add customer credit');

            // Optimistic UI update - immediately reflect the change
            setCustomers(prev => prev.map(c => {
                if (c.id === customerId) {
                    const newCredit = type === 'charge'
                        ? c.currentCredit + amount
                        : c.currentCredit - amount;
                    return { ...c, currentCredit: Math.max(0, newCredit) };
                }
                return c;
            }));

            // Also refresh from server with cache bypass to ensure sync
            const customerResponse = await fetch(`/api/customers?_t=${Date.now()}`, {
                cache: 'no-store'
            });
            if (customerResponse.ok) {
                const customersData: Customer[] = await customerResponse.json();
                setCustomers(customersData);
                // Update IndexedDB cache
                offlineStorage.saveAll(STORES.CUSTOMERS, customersData).catch(() => {});
            }
        } catch (error) {
            console.error("Error adding customer credit:", error);
            alert("Error al agregar el crédito");
        }
    };

    // Cash Withdrawal Functions
    const addCashWithdrawal = async (cashSessionId: string, amount: number, description: string) => {
        try {
            const response = await fetch('/api/cash-withdrawals', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cashSessionId,
                    amount,
                    description,
                    userId: currentUser?.id
                }),
            });

            if (!response.ok) throw new Error('Failed to create cash withdrawal');

            const newWithdrawal = await response.json();
            setCashWithdrawals(prev => [newWithdrawal, ...prev]);

            alert(`✅ Retiro registrado: $${amount.toFixed(2)}`);
        } catch (error) {
            console.error("Error adding cash withdrawal:", error);
            alert("Error al registrar el retiro de efectivo");
            throw error;
        }
    };

    const deleteCashWithdrawal = async (withdrawalId: string) => {
        try {
            const response = await fetch(`/api/cash-withdrawals/${withdrawalId}`, {
                method: 'DELETE',
            });

            if (!response.ok) throw new Error('Failed to delete cash withdrawal');

            setCashWithdrawals(prev => prev.filter(w => w.id !== withdrawalId));
        } catch (error) {
            console.error("Error deleting cash withdrawal:", error);
            alert("Error al eliminar el retiro");
            throw error;
        }
    };

    return (
        <AppContext.Provider value={{
            isInitializing,
            users, currentUser, login, logout, register, approveUser, deleteUser,
            products, addProduct, updateProduct, deleteProduct, importProducts,
            cart, addToCart, removeFromCart, updateCartQuantity, clearCart,
            cartSubtotal, cartTotal,
            orders, createOrder, deleteOrder, refetchOrders,
            expenses, addExpense, updateExpense, deleteExpense,
            coworkingSessions, startCoworkingSession, updateCoworkingSession, finishCoworkingSession, cancelCoworkingSession, deleteCoworkingSession,
            cashSessions, cashWithdrawals, startCashSession, closeCashSession, addCashWithdrawal, deleteCashWithdrawal,
            customers, addCustomer, updateCustomer, deleteCustomer, addCustomerCredit
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