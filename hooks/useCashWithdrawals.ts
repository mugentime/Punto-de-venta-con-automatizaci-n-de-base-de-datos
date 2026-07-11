import { useState } from 'react';
import type { CashWithdrawal } from '../types';

// Extracted from AppContext.tsx (Phase 5 of the architecture cleanup).
export default function useCashWithdrawals() {
    const [cashWithdrawals, setCashWithdrawals] = useState<CashWithdrawal[]>([]);

    // Called by the app-level initial-load effect once withdrawals are fetched/cached.
    const hydrateCashWithdrawals = (data: CashWithdrawal[]) => {
        setCashWithdrawals(data);
    };

    const addCashWithdrawal = async (cashSessionId: string, amount: number, description: string, userId?: string) => {
        try {
            const response = await fetch('/api/cash-withdrawals', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cashSessionId,
                    amount,
                    description,
                    userId
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

    return {
        cashWithdrawals, hydrateCashWithdrawals,
        addCashWithdrawal, deleteCashWithdrawal,
    };
}
