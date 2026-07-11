import { useState } from 'react';
import { sessionCache, CACHE_KEYS } from '../utils/sessionCache';
import type { Expense } from '../types';

// Extracted from AppContext.tsx (Phase 5 of the architecture cleanup).
//
// The original addExpense first checked for an open cash session and, for
// cash-drawer-sourced expenses, created a cash withdrawal before posting the
// expense itself - that requires cashSessions + addCashWithdrawal, which
// don't belong to this resource. `createExpense` here is just the "POST an
// expense, update state" part; that cross-resource check is composed in
// AppContext.tsx, which calls createExpense after handling the withdrawal.
export default function useExpenses() {
    const [expenses, setExpenses] = useState<Expense[]>([]);

    // Called by the app-level initial-load effect once expenses are fetched/cached.
    const hydrateExpenses = (data: Expense[]) => {
        setExpenses(data);
    };

    const createExpense = async (expense: Omit<Expense, 'id'>, userId?: string) => {
        try {
            const response = await fetch('/api/expenses', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...expense, userId }),
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

    return {
        expenses, hydrateExpenses,
        createExpense, updateExpense, deleteExpense,
    };
}
