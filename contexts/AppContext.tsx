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

    // Auth State (still uses localStorage)
    const [users, setUsers] = useLocalStorage<User[]>('users', []);
    const [currentUser, setCurrentUser] = useState<User | null>(null);

    // Product State (now fetched from backend)
    const [products, setProducts] = useState<Product[]>([]);

    // Other Local State (still uses localStorage or component state)
    const [cart, setCart] = useState<CartItem[]>([]);
    const [orders, setOrders] = useLocalStorage<Order[]>('orders', []);
    const [expenses, setExpenses] = useLocalStorage<Expense[]>('expenses', []);
    const [coworkingSessions, setCoworkingSessions] = useLocalStorage<CoworkingSession[]>('coworkingSessions', []);
    const [cashSessions, setCashSessions] = useLocalStorage<CashSession[]>('cashSessions', []);
    
    // --- EFFECTS ---

    // Seed initial admin user if not present
    useEffect(() => {
        const adminExists = users.some(u => u.role === 'admin' && u.username === 'Admin1');
        if (!adminExists) {
            setUsers(prevUsers => [...prevUsers, initialAdmin]);
        }
    }, [users, setUsers]);
    
    // Fetch initial products from the database on app load
    useEffect(() => {
        const fetchProducts = async () => {
            try {
                const response = await fetch('/api/products');
                if (!response.ok) throw new Error('Network response was not ok');
                const data: Product[] = await response.json();
                setProducts(data);
            } catch (error) {
                console.error("Failed to fetch products:", error);
                // Optionally set an error state to show in the UI
            }
        };
        fetchProducts();
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

    // Order Function (updated for stock management)
    const createOrder = async (orderDetails: { clientName: string; serviceType: 'Mesa' | 'Para llevar'; paymentMethod: 'Efectivo' | 'Tarjeta'; }) => {
        if(cart.length === 0) return;
        
        // Decrease stock via API
        const stockUpdates = cart.map(cartItem => ({ id: cartItem.id, quantity: cartItem.quantity }));
        await updateStockForSale(stockUpdates);

        const totalCost = cart.reduce((acc, item) => acc + (item.cost * item.quantity), 0);

        const newOrder: Order = {
            id: `ORD-${Date.now()}`,
            date: new Date().toISOString(),
            items: cart,
            subtotal: cartSubtotal,
            total: cartTotal,
            totalCost: totalCost,
            ...orderDetails
        };
        setOrders(prev => [newOrder, ...prev]);
        clearCart();
    };

    const cartSubtotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
    const cartTotal = cartSubtotal;

    // Expense Functions (no changes)
    const addExpense = (expense: Omit<Expense, 'id'>) => {
        setExpenses(prev => [...prev, { ...expense, id: `EXP-${Date.now()}` }]);
    };
    const updateExpense = (updatedExpense: Expense) => {
        setExpenses(prev => prev.map(e => e.id === updatedExpense.id ? updatedExpense : e));
    };
    const deleteExpense = (expenseId: string) => {
        setExpenses(prev => prev.filter(e => e.id !== expenseId));
    };
    
    // Coworking Functions (updated for stock management)
    const startCoworkingSession = (clientName: string) => {
        const newSession: CoworkingSession = {
            id: `cowork-${Date.now()}`,
            clientName: clientName || 'Cliente',
            startTime: new Date().toISOString(),
            endTime: null,
            status: 'active',
            consumedExtras: [],
        };
        setCoworkingSessions(prev => [newSession, ...prev]);
    };

    const updateCoworkingSession = (sessionId: string, updates: Partial<CoworkingSession>) => {
        setCoworkingSessions(prev => prev.map(s => (s.id === sessionId ? { ...s, ...updates } : s)));
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