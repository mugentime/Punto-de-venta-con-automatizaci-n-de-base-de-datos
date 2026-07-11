import { useState, useEffect } from 'react';
import type { User } from '../types';

// Extracted from AppContext.tsx (Phase 5 of the architecture cleanup).
// Self-contained: login/logout/register/approveUser/deleteUser only ever
// touch `users` and `currentUser`, never another resource's state.
export default function useAuthUsers() {
    const [users, setUsers] = useState<User[]>([]);
    const [currentUser, setCurrentUser] = useState<User | null>(null);

    // Restore user session from localStorage on app load
    useEffect(() => {
        const storedUser = localStorage.getItem('currentUser');
        if (storedUser) {
            try {
                const user = JSON.parse(storedUser);
                setCurrentUser(user);
            } catch (error) {
                console.error('Failed to restore user session:', error);
                localStorage.removeItem('currentUser');
            }
        }
    }, []);

    // Called by the app-level initial-load effect once users are fetched/cached.
    const hydrateUsers = (data: User[]) => {
        setUsers(data);
    };

    const login = async (username: string, password?: string): Promise<void> => {
        try {
            // Call the login API endpoint which validates credentials server-side
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Error al iniciar sesión');
            }

            const user = await response.json();

            // Set current user and persist to localStorage
            setCurrentUser(user);
            localStorage.setItem('currentUser', JSON.stringify(user));
        } catch (error) {
            throw error;
        }
    };

    const logout = () => {
        setCurrentUser(null);
        // Clear from localStorage
        localStorage.removeItem('currentUser');
    };

    const register = async (userDetails: Omit<User, 'id' | 'role' | 'status'>): Promise<void> => {
        // Check for duplicates in local state first (quick validation)
        if (users.some(u => u.username.toLowerCase() === userDetails.username.toLowerCase())) {
            throw new Error('El nombre de usuario ya existe.');
        }
        if (users.some(u => u.email.toLowerCase() === userDetails.email.toLowerCase())) {
            throw new Error('El correo electrónico ya está en uso.');
        }

        try {
            // Create user via API to persist to database
            const response = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...userDetails,
                    role: 'employee',
                    status: 'pending'
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to create user');
            }

            const newUser = await response.json();
            setUsers(prev => [...prev, newUser]);
        } catch (error) {
            console.error("Error registering user:", error);
            throw error;
        }
    };

    const approveUser = async (userId: string) => {
        try {
            const user = users.find(u => u.id === userId);
            if (!user) {
                alert('Usuario no encontrado');
                throw new Error('User not found');
            }

            const response = await fetch(`/api/users/${userId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: user.username,
                    email: user.email,
                    role: user.role,
                    status: 'approved'
                }),
            });

            if (!response.ok) {
                alert('Error al aprobar el usuario. Por favor intente de nuevo.');
                throw new Error('Failed to approve user');
            }

            const updatedUser = await response.json();
            setUsers(prev => prev.map(u => u.id === userId ? updatedUser : u));
            alert(`✅ Usuario ${user.username} aprobado exitosamente`);
        } catch (error) {
            console.error("Error approving user:", error);
            throw error;
        }
    };

    const deleteUser = async (userId: string) => {
        try {
            const response = await fetch(`/api/users/${userId}`, {
                method: 'DELETE',
            });

            if (!response.ok) throw new Error('Failed to delete user');

            setUsers(prev => prev.filter(u => u.id !== userId));
        } catch (error) {
            console.error("Error deleting user:", error);
            throw error;
        }
    };

    return {
        users, currentUser, hydrateUsers,
        login, logout, register, approveUser, deleteUser,
    };
}
