import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import useLocalStorage from '../hooks/useLocalStorage';
import type { Product, CartItem, Order, Expense, CoworkingSession, CashSession, User } from '../types';

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
    createOrder: (orderDetails: { clientName: string; serviceType: 'Mesa' | 'Para llevar'; paymentMethod: 'Efectivo' | 'Tarjeta'; }) => Promise<void>;
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
    // Cash
    cashSessions: CashSession[];
    startCashSession: (startAmount: number) => void;
    closeCashSession: (endAmount: number) => void;
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
    
    // --- EFFECTS ---

    // Fetch all data from database on app load
    useEffect(() => {
        const fetchAllData = async () => {
            try {
                // Fetch products
                const productsResponse = await fetch('/api/products');
                if (productsResponse.ok) {
                    const productsData: Product[] = await productsResponse.json();
                    setProducts(productsData);
                }

                // Fetch orders
                const ordersResponse = await fetch('/api/orders');
                if (ordersResponse.ok) {
                    const ordersData: Order[] = await ordersResponse.json();
                    setOrders(ordersData);
                }

                // Fetch expenses
                const expensesResponse = await fetch('/api/expenses');
                if (expensesResponse.ok) {
                    const expensesData: Expense[] = await expensesResponse.json();
                    setExpenses(expensesData);
                }

                // Fetch coworking sessions
                const coworkingResponse = await fetch('/api/coworking-sessions');
                if (coworkingResponse.ok) {
                    const coworkingData: CoworkingSession[] = await coworkingResponse.json();
                    setCoworkingSessions(coworkingData);
                }

                // Fetch cash sessions
                const cashResponse = await fetch('/api/cash-sessions');
                if (cashResponse.ok) {
                    const cashData: CashSession[] = await cashResponse.json();
                    setCashSessions(cashData);
                }

                // Fetch users
                const usersResponse = await fetch('/api/users');
                if (usersResponse.ok) {
                    const usersData: User[] = await usersResponse.json();
                    setUsers(usersData);
                } else {
                    // Fallback to initial admin if API fails
                    setUsers([initialAdmin]);
                }
            } catch (error) {
                console.error("Failed to fetch data:", error);
                // Fallback to initial admin if everything fails
                setUsers([initialAdmin]);
            }
        };
        fetchAllData();
    }, []);


    // --- FUNCTIONS ---

    // Auth Functions (no changes)
    const login = (username: string, password?: string): Promise<void> => {
        return new Promise((resolve, reject) => {
            const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
            if (!user) {
                return reject(new Error('Usuario no encontrado.'));
            }
            if (user.password !== password) {
                return reject(new Error('Contraseña incorrecta.'));
            }
            if (user.status === 'pending') {
                return reject(new Error('Su cuenta está pendiente de aprobación por un administrador.'));
            }
            const { password: _, ...userToStore } = user;
            setCurrentUser(userToStore);
            resolve();
        });
    };

    const logout = () => {
        setCurrentUser(null);
    };

    const register = (userDetails: Omit<User, 'id' | 'role' | 'status'>): Promise<void> => {
        return new Promise((resolve, reject) => {
            if (users.some(u => u.username.toLowerCase() === userDetails.username.toLowerCase())) {
                return reject(new Error('El nombre de usuario ya existe.'));
            }
            if (users.some(u => u.email.toLowerCase() === userDetails.email.toLowerCase())) {
                return reject(new Error('El correo electrónico ya está en uso.'));
            }
            const newUser: User = {
                ...userDetails,
                id: `user-${Date.now()}`,
                role: 'employee',
                status: 'pending',
            };
            setUsers(prev => [...prev, newUser]);
            resolve();
        });
    };

    const approveUser = (userId: string) => {
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: 'approved' } : u));
    };

    const deleteUser = (userId: string) => {
        setUsers(prev => prev.filter(u => u.id !== userId));
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
    const createOrder = async (orderDetails: { clientName: string; serviceType: 'Mesa' | 'Para llevar'; paymentMethod: 'Efectivo' | 'Tarjeta'; }) => {
        if(cart.length === 0) return;

        try {
            const orderData = {
                ...orderDetails,
                items: cart,
                subtotal: cartSubtotal,
                total: cartTotal,
                userId: currentUser?.id || 'guest',
            };

            // Create order in database
            const response = await fetch('/api/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(orderData),
            });

            if (!response.ok) throw new Error('Failed to create order');
            const newOrder = await response.json();

            // Update local state
            setOrders(prev => [newOrder, ...prev]);

            // Update stock for all items in the cart
            const stockUpdates = cart.map(item => ({
                id: item.id,
                quantity: item.quantity
            }));
            await updateStockForSale(stockUpdates);

            // Clear cart after successful order
            clearCart();
        } catch (error) {
            console.error("Error creating order:", error);
        }
    };

    const cartSubtotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
    const cartTotal = cartSubtotal;

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
        
        // Create Order logic (as before, but stock is already handled)
        const endTime = new Date();
        const startTime = new Date(session.startTime);
        const durationMs = endTime.getTime() - startTime.getTime();
        const durationMinutes = Math.max(0, Math.ceil(durationMs / (1000 * 60)));
        let baseCost = 0;
        if (durationMinutes > 0) {
            if (durationMinutes <= 60) {
                baseCost = 58;
            } else {
                const extraMinutes = durationMinutes - 60;
                const halfHourBlocks = Math.ceil(extraMinutes / 30);
                baseCost = 58 + (halfHourBlocks * 35);
            }
        }
        
        const coworkingServiceItem: CartItem = {
            id: 'COWORK_SERVICE', name: `Servicio Coworking`, price: baseCost, cost: 0, 
            quantity: 1, stock: Infinity, description: `Tiempo: ${durationMinutes} min.`,
            imageUrl: '', category: 'Cafetería',
        };
        
        const allItems = [coworkingServiceItem, ...session.consumedExtras];
        const subtotal = allItems.reduce((acc, item) => acc + item.price * item.quantity, 0);
        const total = subtotal;
        const totalCost = session.consumedExtras.reduce((acc, item) => acc + (item.cost * item.quantity), 0);

        const newOrder: Order = {
            id: `ORD-${Date.now()}`, date: endTime.toISOString(), items: allItems,
            subtotal, total, totalCost, clientName: session.clientName,
            serviceType: 'Mesa', paymentMethod,
        };
        setOrders(prev => [newOrder, ...prev]);

        updateCoworkingSession(sessionId, { endTime: endTime.toISOString(), status: 'finished' });
    };

    // Cash Session Functions (no changes)
    const startCashSession = (startAmount: number) => {
        const existingOpenSession = cashSessions.find(s => s.status === 'open');
        if (existingOpenSession) {
            alert("Ya hay una sesión de caja abierta.");
            return;
        }
        const newSession: CashSession = {
            id: `CS-${Date.now()}`, startDate: new Date().toISOString(), endDate: null,
            startAmount, endAmount: null, status: 'open'
        };
        setCashSessions(prev => [newSession, ...prev]);
    };

    const closeCashSession = (endAmount: number) => {
        const currentSession = cashSessions.find(s => s.status === 'open');
        if (!currentSession) {
            alert("No hay una sesión de caja abierta para cerrar.");
            return;
        }
        const updatedSession: CashSession = {
            ...currentSession, endDate: new Date().toISOString(), endAmount, status: 'closed'
        };
        setCashSessions(prev => prev.map(s => s.id === currentSession.id ? updatedSession : s));
    };

    return (
        <AppContext.Provider value={{
            users, currentUser, login, logout, register, approveUser, deleteUser,
            products, addProduct, updateProduct, deleteProduct, importProducts,
            cart, addToCart, removeFromCart, updateCartQuantity, clearCart,
            cartSubtotal, cartTotal,
            orders, createOrder,
            expenses, addExpense, updateExpense, deleteExpense,
            coworkingSessions, startCoworkingSession, updateCoworkingSession, finishCoworkingSession,
            cashSessions, startCashSession, closeCashSession
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