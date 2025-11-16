import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import useLocalStorage from '../hooks/useLocalStorage';
import type { Product, CartItem, Order, Expense, CoworkingSession, CashSession, User, Customer, CustomerCredit, CashWithdrawal } from '../types';
import { retryFetch } from '../utils/retryWithBackoff';
import { requestDeduplicator, generateIdempotencyKey } from '../utils/requestDeduplication';
import { useWebSocket } from './WebSocketContext';

const initialAdmin: User = {
    id: 'admin-001',
    username: 'Admin1',
    email: 'je2alvarela@gmail.com',
    password: '1357',
    role: 'admin',
    status: 'approved',
};

interface AppContextType {
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
    // Expenses
    expenses: Expense[];
    addExpense: (expense: Omit<Expense, 'id'>) => void;
    updateExpense: (expense: Expense) => void;
    deleteExpense: (expenseId: string) => void;
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

    // Fetch all data from database on app load - OPTIMIZED with parallel fetches
    useEffect(() => {
        const fetchAllData = async () => {
            try {
                const startTime = Date.now();
                console.log('🚀 Starting parallel data fetch...');

                // ⚡ OPTIMIZATION: Fetch ALL resources in PARALLEL using Promise.all
                const [
                    productsResponse,
                    ordersResponse,
                    expensesResponse,
                    coworkingResponse,
                    cashResponse,
                    usersResponse,
                    customersResponse,
                    withdrawalsResponse
                ] = await Promise.all([
                    fetch('/api/products'),
                    fetch('/api/orders?limit=500'),  // Fetch more initial records
                    fetch('/api/expenses?limit=200'),
                    fetch('/api/coworking-sessions?limit=200'),
                    fetch('/api/cash-sessions?limit=100'),
                    fetch('/api/users'),
                    fetch('/api/customers?limit=500'),
                    fetch('/api/cash-withdrawals')
                ]);

                const fetchDuration = Date.now() - startTime;
                console.log(`✓ All fetches completed in ${fetchDuration}ms`);

                // Process products
                if (productsResponse.ok) {
                    const productsData: Product[] = await productsResponse.json();
                    setProducts(productsData);
                }

                // Process orders (paginated response)
                if (ordersResponse.ok) {
                    const ordersResult = await ordersResponse.json();
                    const ordersData: Order[] = ordersResult.data || ordersResult;
                    setOrders(ordersData);
                    console.log(`✓ Loaded ${ordersData.length}/${ordersResult.pagination?.total || ordersData.length} orders`);
                }

                // Process expenses (paginated response)
                if (expensesResponse.ok) {
                    const expensesResult = await expensesResponse.json();
                    const expensesData: Expense[] = expensesResult.data || expensesResult;
                    setExpenses(expensesData);
                    console.log(`✓ Loaded ${expensesData.length}/${expensesResult.pagination?.total || expensesData.length} expenses`);
                }

                // Process coworking sessions (paginated response)
                if (coworkingResponse.ok) {
                    const coworkingResult = await coworkingResponse.json();
                    const coworkingData: CoworkingSession[] = coworkingResult.data || coworkingResult;
                    setCoworkingSessions(coworkingData);
                    console.log(`✓ Loaded ${coworkingData.length}/${coworkingResult.pagination?.total || coworkingData.length} coworking sessions`);
                }

                // Process cash sessions (paginated response)
                if (cashResponse.ok) {
                    const cashResult = await cashResponse.json();
                    const cashData: any[] = cashResult.data || cashResult;
                    // Map API response to frontend CashSession type
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
                    console.log(`✓ Loaded ${mappedSessions.length}/${cashResult.pagination?.total || mappedSessions.length} cash sessions`);
                }

                // Process users
                if (usersResponse.ok) {
                    const usersData: User[] = await usersResponse.json();
                    setUsers(usersData);
                } else {
                    // Fallback to initial admin if API fails
                    setUsers([initialAdmin]);
                }

                // Process customers (paginated response)
                if (customersResponse.ok) {
                    const customersResult = await customersResponse.json();
                    const customersData: Customer[] = customersResult.data || customersResult;
                    setCustomers(customersData);
                    console.log(`✓ Loaded ${customersData.length}/${customersResult.pagination?.total || customersData.length} customers`);
                }

                // Process cash withdrawals
                if (withdrawalsResponse.ok) {
                    const withdrawalsData: CashWithdrawal[] = await withdrawalsResponse.json();
                    setCashWithdrawals(withdrawalsData);
                }

                const totalDuration = Date.now() - startTime;
                console.log(`✅ All data loaded and processed in ${totalDuration}ms (${(totalDuration / 1000).toFixed(2)}s)`);
            } catch (error) {
                console.error("❌ Failed to fetch data:", error);
                // Fallback to initial admin if everything fails
                setUsers([initialAdmin]);
            }
        };
        fetchAllData();
    }, []);

    // 🔄 REAL-TIME SYNC: WebSocket subscription for coworking sessions
    const { subscribe, isConnected } = useWebSocket();

    useEffect(() => {
        // Initial load of coworking sessions (handle paginated response)
        const loadCoworkingSessions = async () => {
            try {
                const response = await fetch('/api/coworking-sessions?limit=200');
                if (response.ok) {
                    const result = await response.json();
                    const sessions: CoworkingSession[] = result.data || result;
                    setCoworkingSessions(sessions);
                }
            } catch (error) {
                console.error('Failed to load coworking sessions:', error);
            }
        };

        loadCoworkingSessions();
    }, []);

    useEffect(() => {
        // Subscribe to real-time coworking updates via WebSocket
        const unsubscribe = subscribe('coworking:update', ({ type, session }: { type: 'create' | 'update' | 'delete'; session: CoworkingSession | { id: string } }) => {
            console.log(`[AppContext] Received coworking ${type} update:`, session);

            setCoworkingSessions(prev => {
                switch (type) {
                    case 'create':
                        // Add new session if not already present
                        return prev.some(s => s.id === (session as CoworkingSession).id)
                            ? prev
                            : [session as CoworkingSession, ...prev];

                    case 'update':
                        // Update existing session
                        return prev.map(s => s.id === (session as CoworkingSession).id ? session as CoworkingSession : s);

                    case 'delete':
                        // Remove deleted session
                        return prev.filter(s => s.id !== session.id);

                    default:
                        return prev;
                }
            });
        });

        return unsubscribe;
    }, [subscribe]);

    // 🔄 REAL-TIME SYNC: WebSocket subscription for cash sessions
    useEffect(() => {
        const unsubscribe = subscribe('cash:update', ({ type, data }: { type: 'create' | 'update' | 'delete'; data: any }) => {
            console.log(`[AppContext] Received cash ${type} update:`, data);

            setCashSessions(prev => {
                switch (type) {
                    case 'create':
                        return prev.some(s => s.id === data.id) ? prev : [data, ...prev];
                    case 'update':
                        return prev.map(s => s.id === data.id ? data : s);
                    case 'delete':
                        return prev.filter(s => s.id !== data.id);
                    default:
                        return prev;
                }
            });
        });

        return unsubscribe;
    }, [subscribe]);

    // 🔄 REAL-TIME SYNC: WebSocket subscription for customers
    useEffect(() => {
        const unsubscribe = subscribe('customers:update', ({ type, data }: { type: 'create' | 'update' | 'delete'; data: any }) => {
            console.log(`[AppContext] Received customers ${type} update:`, data);

            setCustomers(prev => {
                switch (type) {
                    case 'create':
                        return prev.some(c => c.id === data.id) ? prev : [...prev, data].sort((a, b) => a.name.localeCompare(b.name));
                    case 'update':
                        return prev.map(c => c.id === data.id ? data : c);
                    case 'delete':
                        return prev.filter(c => c.id !== data.id);
                    default:
                        return prev;
                }
            });
        });

        return unsubscribe;
    }, [subscribe]);

    // 🔄 REAL-TIME SYNC: WebSocket subscription for orders
    useEffect(() => {
        const unsubscribe = subscribe('orders:update', ({ type, data }: { type: 'create' | 'update' | 'delete'; data: any }) => {
            console.log(`[AppContext] Received orders ${type} update:`, data);

            setOrders(prev => {
                switch (type) {
                    case 'create':
                        return prev.some(o => o.id === data.id) ? prev : [data, ...prev];
                    case 'update':
                        return prev.map(o => o.id === data.id ? data : o);
                    case 'delete':
                        return prev.filter(o => o.id !== data.id);
                    default:
                        return prev;
                }
            });
        });

        return unsubscribe;
    }, [subscribe]);

    // 🔄 REAL-TIME SYNC: WebSocket subscription for products
    useEffect(() => {
        const unsubscribe = subscribe('products:update', ({ type, data }: { type: 'create' | 'update' | 'delete'; data: any }) => {
            console.log(`[AppContext] Received products ${type} update:`, data);

            setProducts(prev => {
                switch (type) {
                    case 'create':
                        return prev.some(p => p.id === data.id) ? prev : [...prev, data].sort((a, b) => a.name.localeCompare(b.name));
                    case 'update':
                        return prev.map(p => p.id === data.id ? data : p);
                    case 'delete':
                        return prev.filter(p => p.id !== data.id);
                    default:
                        return prev;
                }
            });
        });

        return unsubscribe;
    }, [subscribe]);

    // Fallback: Poll if WebSocket disconnected (graceful degradation)
    useEffect(() => {
        if (isConnected) return; // WebSocket is working, no need to poll

        console.log('[AppContext] WebSocket disconnected, falling back to polling for ALL resources');

        const pollAllResources = async () => {
            try {
                // Poll coworking sessions (handle paginated response)
                const coworkingRes = await fetch('/api/coworking-sessions?limit=100');
                if (coworkingRes.ok) {
                    const coworkingResult = await coworkingRes.json();
                    const sessions: CoworkingSession[] = coworkingResult.data || coworkingResult;
                    setCoworkingSessions(sessions);
                }

                // Poll cash sessions (handle paginated response)
                const cashRes = await fetch('/api/cash-sessions?limit=50');
                if (cashRes.ok) {
                    const cashResult = await cashRes.json();
                    const cashData: any[] = cashResult.data || cashResult;
                    // Map API response to frontend CashSession type
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
                }

                // Poll customers (handle paginated response)
                const customersRes = await fetch('/api/customers?limit=500');
                if (customersRes.ok) {
                    const customersResult = await customersRes.json();
                    const customersData: Customer[] = customersResult.data || customersResult;
                    setCustomers(customersData);
                }

                // Poll orders (handle paginated response)
                const ordersRes = await fetch('/api/orders?limit=100');
                if (ordersRes.ok) {
                    const ordersResult = await ordersRes.json();
                    const ordersData: Order[] = ordersResult.data || ordersResult;
                    setOrders(ordersData);
                }

                // Poll products
                const productsRes = await fetch('/api/products');
                if (productsRes.ok) {
                    const productsData = await productsRes.json();
                    setProducts(productsData);
                }
            } catch (error) {
                console.error('Failed to poll resources:', error);
            }
        };

        // Poll every 5 seconds when WebSocket is disconnected
        const interval = setInterval(pollAllResources, 5000);

        return () => {
            clearInterval(interval);
        };
    }, [isConnected]);


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
            setProducts(prev => [...prev, newProduct]);
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
            setProducts(prev => prev.map(p => p.id === returnedProduct.id ? returnedProduct : p));
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
            setProducts(prev => prev.filter(p => p.id !== productId));
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

        // Capture cart state before async operations
        const orderCart = [...cart];
        const orderSubtotal = cartSubtotal;

        // Calculate discount from customer
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

        // CRITICAL FIX: Do NOT clear cart until after server confirms success
        // This prevents data loss if network request fails

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
            // Generate stable idempotency key based on cart contents
            const idempotencyKey = generateIdempotencyKey('order', orderCart, orderDetails);

            const orderData = {
                ...orderDetails,
                items: orderCart,
                subtotal: orderSubtotal,
                discount,
                total: orderTotal,
                userId: currentUser?.id || 'guest',
                customerId: orderDetails.customerId || null,
                tip: tipAmount,
            };

            console.log('📡 Sending order to API with idempotency key:', idempotencyKey);

            // Use request deduplication to prevent multiple simultaneous requests
            const response = await requestDeduplicator.deduplicate(
                idempotencyKey,
                async () => {
                    // Use retry logic for network resilience
                    return await retryFetch(
                        '/api/orders',
                        {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'X-Idempotency-Key': idempotencyKey
                            },
                            body: JSON.stringify(orderData),
                        },
                        {
                            maxAttempts: 3,
                            onRetry: (attempt) => {
                                console.log(`⏳ Retrying order creation (attempt ${attempt})...`);
                            },
                        },
                        15000 // 15 second timeout
                    );
                }
            );

            console.log('📡 Server response status:', response.status);

            const newOrder = await response.json();
            console.log('✅ Order saved successfully:', newOrder.id);

            // Update local state
            setOrders(prev => [newOrder, ...prev]);

            // NOW clear cart after successful server response
            clearCart();

            // Stock update is handled by stored procedure on server
            // No need for separate updateStockForSale call
            console.log('✅ Stock updated automatically by stored procedure');

            alert(`✅ Venta guardada: ${orderDetails.clientName} - $${orderTotal.toFixed(2)}`);
        } catch (error) {
            console.error("❌ Error creating order:", error);
            alert(`❌ ERROR: La venta NO se guardó. ${error.message || error}`);
            // Cart remains intact for user to retry
            throw error;
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

            // Update local state
            setOrders(prev => prev.filter(o => o.id !== orderId));

            console.log('✅ Order deleted successfully:', orderId);
        } catch (error) {
            console.error("Error deleting order:", error);
            alert("Error al eliminar la orden");
            throw error;
        }
    };

    // Expense Functions (updated for API)
    const addExpense = async (expense: Omit<Expense, 'id'>) => {
        try {
            const response = await fetch('/api/expenses', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...expense, userId: currentUser?.id }),
            });
            if (!response.ok) throw new Error('Failed to create expense');
            const newExpense = await response.json();
            setExpenses(prev => [newExpense, ...prev]);
        } catch (error) {
            console.error("Error adding expense:", error);
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
            setExpenses(prev => prev.map(e => e.id === returnedExpense.id ? returnedExpense : e));
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
            setExpenses(prev => prev.filter(e => e.id !== expenseId));
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
            setCoworkingSessions(prev => [newSession, ...prev]);
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
            setCoworkingSessions(prev => prev.map(s => s.id === sessionId ? updatedSession : s));
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
                setOrders(prev => [createdOrder, ...prev]);
                console.log('✅ Coworking order successfully saved to database:', createdOrder.id);
                alert(`✅ Sesión de coworking guardada: ${session.clientName} - $${total.toFixed(2)}`);
            } else {
                const errorText = await response.text();
                console.error('❌ Failed to save coworking order. Status:', response.status, 'Error:', errorText);
                alert(`⚠️ Error al guardar la orden de coworking: ${response.status} - ${errorText}`);
                // Fallback to local state only
                setOrders(prev => [newOrder, ...prev]);
            }
        } catch (error) {
            console.error('❌ Error saving coworking order:', error);
            alert(`⚠️ Error al guardar la orden de coworking: ${error.message}`);
            // Fallback to local state only
            setOrders(prev => [newOrder, ...prev]);
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

            setCashSessions(prev => [mappedSession, ...prev]);
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

            setCashSessions(prev => prev.map(s => s.id === currentSession.id ? mappedSession : s));
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

            // Refresh customer data to get updated currentCredit (handle paginated response)
            const customerResponse = await fetch('/api/customers?limit=500');
            if (customerResponse.ok) {
                const result = await customerResponse.json();
                const customersData: Customer[] = result.data || result;
                setCustomers(customersData);
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
            users, currentUser, login, logout, register, approveUser, deleteUser,
            products, addProduct, updateProduct, deleteProduct, importProducts,
            cart, addToCart, removeFromCart, updateCartQuantity, clearCart,
            cartSubtotal, cartTotal,
            orders, createOrder, deleteOrder,
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