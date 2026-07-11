import { useState } from 'react';
import offlineStorage, { STORES } from '../utils/offlineStorage';
import type { Customer } from '../types';

// Extracted from AppContext.tsx (Phase 5 of the architecture cleanup).
export default function useCustomers() {
    const [customers, setCustomers] = useState<Customer[]>([]);

    // Called by the app-level initial-load effect once customers are fetched/cached.
    const hydrateCustomers = (data: Customer[]) => {
        setCustomers(data);
    };

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

    return {
        customers, hydrateCustomers,
        addCustomer, updateCustomer, deleteCustomer, addCustomerCredit,
    };
}
