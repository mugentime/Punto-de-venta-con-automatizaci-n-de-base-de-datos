import { useState } from 'react';
import { sessionCache, CACHE_KEYS } from '../utils/sessionCache';
import type { Order } from '../types';

// Extracted from AppContext.tsx (Phase 5 of the architecture cleanup).
//
// createOrder itself isn't here - it needs the cart, a customer discount
// lookup, and triggers a product stock update, none of which are this
// resource's concern. This hook exposes `pushOrder` (add a
// server-confirmed order to state + cache) for the composition layer to
// call after it does that orchestration and the actual POST - the same
// helper both createOrder and finishCoworkingSession use.
export default function useOrders() {
    const [orders, setOrders] = useState<Order[]>([]);

    // Called by the app-level initial-load effect once orders are fetched/cached.
    const hydrateOrders = (data: Order[]) => {
        setOrders(data);
    };

    const pushOrder = (order: Order) => {
        setOrders(prev => {
            const updated = [order, ...prev];
            sessionCache.set(CACHE_KEYS.ORDERS, updated);
            return updated;
        });
    };

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

    return {
        orders, hydrateOrders, pushOrder,
        deleteOrder, refetchOrders,
    };
}
