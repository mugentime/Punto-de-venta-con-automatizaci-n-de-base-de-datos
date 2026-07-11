import { useState, useEffect, useMemo } from 'react';
import { sessionCache, CACHE_KEYS } from '../utils/sessionCache';
import { dedupedFetch } from '../utils/apiCache';
import type { CoworkingSession } from '../types';

// Extracted from AppContext.tsx (Phase 5 of the architecture cleanup).
//
// finishCoworkingSession is NOT here - it needs products.updateStockForSale
// and orders state to create the closing order, so it's composed in
// AppContext.tsx out of this hook's updateCoworkingSession plus the
// products/orders hooks. Everything that only ever touches
// coworking-sessions state lives here.
export default function useCoworkingSessions() {
    const [coworkingSessions, setCoworkingSessions] = useState<CoworkingSession[]>([]);

    // Called by the app-level initial-load effect once sessions are fetched/cached.
    const hydrateCoworkingSessions = (data: CoworkingSession[]) => {
        setCoworkingSessions(data);
    };

    // 🔄 MINIMAL POLLING: Only poll when there are ACTIVE coworking sessions
    // No polling = no API calls = cheap & fast
    const activeSessionCount = useMemo(
        () => coworkingSessions.filter(s => s.status === 'active').length,
        [coworkingSessions]
    );

    useEffect(() => {
        // NO POLLING if no active sessions - saves API calls
        if (activeSessionCount === 0) {
            console.log('⏱️ No active coworking sessions - polling disabled');
            return;
        }

        console.log('⏱️ Active coworking session detected - polling every 10s');

        const pollCoworkingSessions = async () => {
            if (document.visibilityState !== 'visible' || !navigator.onLine) return;

            try {
                const sessions = await dedupedFetch<CoworkingSession[]>('/api/coworking-sessions', {}, true);
                setCoworkingSessions(sessions);
                sessionCache.set(CACHE_KEYS.COWORKING_SESSIONS, sessions);
            } catch (error) {
                console.error('Failed to poll coworking sessions:', error);
            }
        };

        // Poll every 10 seconds ONLY when active sessions exist
        const interval = setInterval(pollCoworkingSessions, 10000);

        return () => clearInterval(interval);
    }, [activeSessionCount]); // Stable memoized value - no infinite loop

    const startCoworkingSession = async (clientName: string) => {
        try {
            const sessionData = {
                clientName: clientName || 'Cliente',
                startTime: new Date().toISOString(),
                hourlyRate: 62,
            };

            const response = await fetch('/api/coworking-sessions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(sessionData),
            });

            if (!response.ok) throw new Error('Failed to create coworking session');
            const newSession = await response.json();

            // Invalidate Service Worker cache for coworking-sessions API
            if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                navigator.serviceWorker.controller.postMessage({
                    type: 'INVALIDATE_API',
                    endpoint: 'coworking-sessions'
                });
            }

            setCoworkingSessions(prev => {
                const updated = [newSession, ...prev];
                sessionCache.set(CACHE_KEYS.COWORKING_SESSIONS, updated);
                return updated;
            });
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

            // Invalidate Service Worker cache for coworking-sessions API
            if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                navigator.serviceWorker.controller.postMessage({
                    type: 'INVALIDATE_API',
                    endpoint: 'coworking-sessions'
                });
            }

            setCoworkingSessions(prev => {
                const updated = prev.map(s => s.id === sessionId ? updatedSession : s);
                sessionCache.set(CACHE_KEYS.COWORKING_SESSIONS, updated);
                return updated;
            });
        } catch (error) {
            console.error("Error updating coworking session:", error);
        }
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

            // Invalidate Service Worker cache for coworking-sessions API
            if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                navigator.serviceWorker.controller.postMessage({
                    type: 'INVALIDATE_API',
                    endpoint: 'coworking-sessions'
                });
            }

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

            // Invalidate Service Worker cache for coworking-sessions API
            if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                navigator.serviceWorker.controller.postMessage({
                    type: 'INVALIDATE_API',
                    endpoint: 'coworking-sessions'
                });
            }

            setCoworkingSessions(prev => prev.filter(s => s.id !== sessionId));
        } catch (error) {
            console.error("Error deleting coworking session:", error);
            // Fallback to local state update if API fails
            setCoworkingSessions(prev => prev.filter(s => s.id !== sessionId));
        }
    };

    return {
        coworkingSessions, hydrateCoworkingSessions,
        startCoworkingSession, updateCoworkingSession, cancelCoworkingSession, deleteCoworkingSession,
    };
}
