import { useState } from 'react';
import { sessionCache, CACHE_KEYS } from '../utils/sessionCache';
import type { Product } from '../types';

// Extracted from AppContext.tsx (Phase 5 of the architecture cleanup).
// `updateStockForSale` is exposed because orders and coworking-session
// checkout both need to decrement stock after a sale - that's the one
// piece of this hook other hooks legitimately depend on.
export default function useProducts() {
    const [products, setProducts] = useState<Product[]>([]);

    // Called by the app-level initial-load effect once products are fetched/cached.
    const hydrateProducts = (data: Product[]) => {
        setProducts(data);
    };

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

    // Decrements local stock after a sale. Used by createOrder and
    // finishCoworkingSession (both live in AppContext.tsx's composition layer).
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
    };

    return {
        products, hydrateProducts,
        addProduct, updateProduct, deleteProduct, importProducts, updateStockForSale,
    };
}
