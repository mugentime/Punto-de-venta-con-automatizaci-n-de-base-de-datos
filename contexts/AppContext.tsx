import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import useLocalStorage from '../hooks/useLocalStorage';
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

    // Fetch all data from database on app load
    useEffect(() => {
        const fetchAllData = async () => {
            console.log('🔄 Starting data fetch...');
            try {
                // Fetch products with individual error handling
                try {
                    console.log('📦 Fetching products...');
                    const productsResponse = await fetch('/api/products');
                    console.log('📦 Products response:', productsResponse.status);
                    if (productsResponse.ok) {
                        const productsData: Product[] = await productsResponse.json();
                        console.log('📦 Products loaded:', productsData.length, 'items');
                        setProducts(productsData);
                    } else {
                        console.error('❌ Failed to fetch products:', await productsResponse.text());
                    }
                } catch (error) {
                    console.error('❌ Error fetching products:', error);
                }

                // Fetch orders with individual error handling
                try {
                    console.log('📋 Fetching orders...');
                    const ordersResponse = await fetch('/api/orders');
                    console.log('📋 Orders response:', ordersResponse.status);
                    if (ordersResponse.ok) {
                        const ordersData: Order[] = await ordersResponse.json();
                        console.log('📋 Orders loaded:', ordersData.length, 'orders');
                        console.log('📋 Date range:', ordersData.length > 0 ?
                            `${new Date(ordersData[ordersData.length-1].date).toLocaleDateString()} to ${new Date(ordersData[0].date).toLocaleDateString()}` :
                            'No orders');
                        setOrders(ordersData);
                    } else {
                        console.error('❌ Failed to fetch orders:', await ordersResponse.text());
                    }
                } catch (error) {
                    console.error('❌ Error fetching orders:', error);
                }

                // Fetch expenses with individual error handling
                try {
                    const expensesResponse = await fetch('/api/expenses');
                    if (expensesResponse.ok) {
                        const expensesData: Expense[] = await expensesResponse.json();
                        setExpenses(expensesData);
                    }
                } catch (error) {
                    console.error('❌ Error fetching expenses:', error);
                }

                // Fetch coworking sessions with individual error handling
                try {
                    const coworkingResponse = await fetch('/api/coworking-sessions');
                    if (coworkingResponse.ok) {
                        const coworkingData: CoworkingSession[] = await coworkingResponse.json();
                        setCoworkingSessions(coworkingData);
                    }
                } catch (error) {
                    console.error('❌ Error fetching coworking sessions:', error);
                }

                // Fetch cash sessions with individual error handling
                try {
                    // 🚀 PERFORMANCE FIX: Limit initial load to recent sessions only
                    const cashResponse = await fetch('/api/cash-sessions?limit=100');
                    console.log('💰 Cash sessions response:', cashResponse.status);
                    if (cashResponse.ok) {
                        const cashData: any[] = await cashResponse.json();
                        console.log(`💰 Loaded ${cashData.length} recent cash sessions (limit: 100)`);
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
                        console.log('✅ Cash sessions mapped successfully');
                        setCashSessions(mappedSessions);
                    } else {
                        console.error('❌ Failed to fetch cash sessions:', await cashResponse.text());
                    }
                } catch (error) {
                    console.error('❌ Error fetching cash sessions:', error);
                }

                // Fetch users with individual error handling
                try {
                    const usersResponse = await fetch('/api/users');
                    if (usersResponse.ok) {
                        const usersData: User[] = await usersResponse.json();
                        setUsers(usersData);
                    } else {
                        // Fallback to initial admin if API fails
                        setUsers([initialAdmin]);
                    }
                } catch (error) {
                    console.error('❌ Error fetching users:', error);
                    setUsers([initialAdmin]);
                }

                // Fetch customers with individual error handling
                try {
                    const customersResponse = await fetch('/api/customers');
                    console.log('👥 Customers response:', customersResponse.status);
                    if (customersResponse.ok) {
                        const customersData: Customer[] = await customersResponse.json();
                        console.log('👥 Customers data:', customersData);
                        setCustomers(customersData);
                    } else {
                        console.error('❌ Failed to fetch customers:', await customersResponse.text());
                    }
                } catch (error) {
                    console.error('❌ Error fetching customers:', error);
                }

                // Fetch cash withdrawals with individual error handling
                try {
                    const withdrawalsResponse = await fetch('/api/cash-withdrawals');
                    if (withdrawalsResponse.ok) {
                        const withdrawalsData: CashWithdrawal[] = await withdrawalsResponse.json();
                        setCashWithdrawals(withdrawalsData);
                    }
                } catch (error) {
                    console.error('❌ Error fetching cash withdrawals:', error);
                }
            } catch (error) {
                console.error("Failed to fetch data:", error);
                // Fallback to initial admin if everything fails
                setUsers([initialAdmin]);
            }
        };
        fetchAllData();
    }, []);

    // 🔄 CROSS-DEVICE SYNC: Poll for coworking sessions every 5 seconds
    useEffect(() => {
        const pollCoworkingSessions = async () => {
            try {
                const response = await fetch('/api/coworking-sessions');
                if (response.ok) {
                    const sessions: CoworkingSession[] = await response.json();
                    setCoworkingSessions(sessions);
                }
            } catch (error) {
                console.error('Failed to poll coworking sessions:', error);
            }
        };

        // Poll every 5 seconds when document is visible
        const interval = setInterval(() => {
            if (document.visibilityState === 'visible') {
                pollCoworkingSessions();
            }
        }, 5000);

        // Poll immediately when tab becomes visible
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                pollCoworkingSessions();
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            clearInterval(interval);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, []);


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

            // Update local state
            setOrders(prev => [newOrder, ...prev]);

            // 🔄 OPTION B: Invalidate cache - force refetch after successful order creation
            await refetchOrders();

            // Update stock for all items in the cart
            const stockUpdates = orderCart.map(item => ({
                id: item.id,
                quantity: item.quantity
            }));
            await updateStockForSale(stockUpdates);

            alert(`✅ Venta guardada: ${orderDetails.clientName} - $${orderTotal.toFixed(2)}`);
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

            // Update local state
            setOrders(prev => prev.filter(o => o.id !== orderId));

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
            setExpenses(prev => [newExpense, ...prev]);

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

            // Refresh customer data to get updated currentCredit
            const customerResponse = await fetch('/api/customers');
            if (customerResponse.ok) {
                const customersData: Customer[] = await customerResponse.json();
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