import { useState } from 'react';
import type { Product, CartItem } from '../types';

// Extracted from AppContext.tsx (Phase 5 of the architecture cleanup).
// Pure local state - no API calls, no dependency on any other resource.
export default function useCart() {
    const [cart, setCart] = useState<CartItem[]>([]);

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

    const cartSubtotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
    const cartTotal = cartSubtotal;

    return { cart, addToCart, removeFromCart, updateCartQuantity, clearCart, cartSubtotal, cartTotal };
}
