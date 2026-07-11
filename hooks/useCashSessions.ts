import { useState } from 'react';
import { sessionCache, CACHE_KEYS } from '../utils/sessionCache';
import type { CashSession } from '../types';

// Extracted from AppContext.tsx (Phase 5 of the architecture cleanup).
//
// closeCashSession's totals calculation reads orders + expenses +
// coworkingSessions + cashWithdrawals to compute the closing summary - none
// of which belong to this resource. This hook exposes
// `closeCashSessionRequest` (PUT the already-computed totals, update state)
// for the composition layer to call once it has done that cross-resource math.
export default function useCashSessions() {
    const [cashSessions, setCashSessions] = useState<CashSession[]>([]);

    // Called by the app-level initial-load effect once sessions are fetched/cached.
    const hydrateCashSessions = (data: CashSession[]) => {
        setCashSessions(data);
    };

    const startCashSession = async (startAmount: number, userId?: string) => {
        const existingOpenSession = cashSessions.find(s => s.status === 'open');
        if (existingOpenSession) {
            alert("Ya hay una sesión de caja abierta.");
            return;
        }

        try {
            const sessionData = {
                startAmount,
                startTime: new Date().toISOString(),
                userId: userId || 'guest'
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

            setCashSessions(prev => {
                const updated = [mappedSession, ...prev];
                sessionCache.set(CACHE_KEYS.CASH_SESSIONS, updated);
                return updated;
            });
        } catch (error) {
            console.error("Error starting cash session:", error);
            alert("Error al iniciar la sesión de caja");
        }
    };

    const closeCashSessionRequest = async (sessionId: string, updateData: {
        endAmount: number; endTime: string; totalSales: number; totalExpenses: number;
        expectedCash: number; difference: number; status: string;
    }) => {
        try {
            const response = await fetch(`/api/cash-sessions/${sessionId}`, {
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

            setCashSessions(prev => {
                const updated = prev.map(s => s.id === sessionId ? mappedSession : s);
                sessionCache.set(CACHE_KEYS.CASH_SESSIONS, updated);
                return updated;
            });
        } catch (error) {
            console.error("Error closing cash session:", error);
            alert("Error al cerrar la sesión de caja");
        }
    };

    return {
        cashSessions, hydrateCashSessions,
        startCashSession, closeCashSessionRequest,
    };
}
