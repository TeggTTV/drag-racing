import React, { createContext, useContext, useState, useEffect } from 'react';
import { getFullUrl } from '../utils/prisma';

// Basic JWT Decode Helper
const decodeJwt = (token: string) => {
	try {
		const base64Url = token.split('.')[1];
		const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
		const jsonPayload = decodeURIComponent(
			window
				.atob(base64)
				.split('')
				.map(function (c) {
					return (
						'%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
					);
				})
				.join('')
		);
		return JSON.parse(jsonPayload);
	} catch (e) {
		return null;
	}
};

export interface User {
	id: string;
	username: string;
	email: string;
	partyId?: string;
	level?: number;
	partyInvites?: string[];
	friendRequestsReceived?: string[];
}

interface AuthContextType {
	user: User | null;
	token: string | null;
	isOnline: boolean;
	login: (token: string, userData: User) => void;
	logout: () => void;
	refreshUser: () => Promise<void>;
	isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

import { useToast } from './ToastContext';

// ... (keep existing imports)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
	children,
}) => {
	const { showToast } = useToast();
	const [user, setUser] = useState<User | null>(null);
	const [token, setToken] = useState<string | null>(null);
	const [isOnline, setIsOnline] = useState(false);
	const [isLoading, setIsLoading] = useState(true);

	// Track previous invites to detect new ones
	const prevInvitesRef = React.useRef<number>(0);

	useEffect(() => {
		// Check for token in localStorage on mount
		const storedToken = localStorage.getItem('auth_token');
		const storedUser = localStorage.getItem('auth_user');

		if (storedToken && storedUser) {
			// Basic expiration check using helper
			const decoded = decodeJwt(storedToken);
			// If mock token, skip expiration
			const isMock = storedToken === 'mock-token';

			if (isMock || (decoded && decoded.exp * 1000 > Date.now())) {
				setToken(storedToken);
				const parsedUser = JSON.parse(storedUser);
				setUser(parsedUser);
				prevInvitesRef.current = parsedUser.partyInvites?.length || 0;
				setIsOnline(true);
			} else {
				// Expired
				localStorage.removeItem('auth_token');
				localStorage.removeItem('auth_user');
			}
		} else {
			// No token found - User remains offline
			setIsLoading(false);
		}
		setIsLoading(false);
	}, []);

	// Keep a ref to the current user to avoid dependency cycles in refreshUser
	const userRef = React.useRef(user);
	useEffect(() => {
		userRef.current = user;
	}, [user]);

	// Refresh user data on mount to get latest friend requests
	const refreshUser = React.useCallback(async () => {
		const currentUser = userRef.current;
		if (!token || !currentUser) return;

		// Mock Refresh
		if (token === 'mock-token') {
			// Just indicate success
			return;
		}

		try {
			const res = await fetch(
				getFullUrl('/api/users/:id').replace(':id', currentUser.id),
				{
					headers: { Authorization: `Bearer ${token}` },
				}
			);
			if (res.ok) {
				const data = await res.json();
				const updatedUser = { ...currentUser, ...data };

				// Update ref
				const newCount = updatedUser.partyInvites?.length || 0;
				prevInvitesRef.current = newCount;

				setUser(updatedUser);
				localStorage.setItem('auth_user', JSON.stringify(updatedUser));
			}
		} catch (e) {
			console.error(e);
		}
	}, [token]);

	// Refresh user data on mount to get latest friend requests
	useEffect(() => {
		if (token && isOnline) {
			refreshUser();
		}
	}, [token, isOnline, refreshUser]);

	const login = (newToken: string, userData: User) => {
		setToken(newToken);
		setUser(userData);
		prevInvitesRef.current = userData.partyInvites?.length || 0;
		setIsOnline(true);
		localStorage.setItem('auth_token', newToken);
		localStorage.setItem('auth_user', JSON.stringify(userData));
	};

	const logout = () => {
		setToken(null);
		setUser(null);
		setIsOnline(false);
		localStorage.removeItem('auth_token');
		localStorage.removeItem('auth_user');
	};

	return (
		<AuthContext.Provider
			value={{
				user,
				token,
				isOnline,
				login,
				logout,
				refreshUser,
				isLoading,
			}}
		>
			{children}
		</AuthContext.Provider>
	);
};

export const useAuth = () => {
	const context = useContext(AuthContext);
	if (!context) {
		throw new Error('useAuth must be used within an AuthProvider');
	}
	return context;
};
