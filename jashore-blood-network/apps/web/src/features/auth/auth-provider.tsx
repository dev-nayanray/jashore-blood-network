/**
 * Auth context provider for the Next.js frontend.
 *
 * On mount, calls /api/v1/auth/me to check if the user is authenticated.
 * Exposes the user, loading state, and login/logout helpers.
 *
 * The session is managed entirely by httpOnly cookies set by the backend —
 * the frontend never sees the access token or refresh token in JavaScript.
 * This is the XSS-resistant pattern recommended by Supabase and OWASP.
 */

'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { apiBaseUrl } from '@/lib/env';

export interface AuthUser {
  id: string;
  phone?: string;
  email?: string | null;
  fullName: string;
  isActive: boolean;
  roles: string[];
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  error: null,
  refresh: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${apiBaseUrl}/auth/me`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.status === 401) {
        setUser(null);
        return;
      }
      if (!res.ok) {
        throw new Error(`Auth check failed: ${res.status}`);
      }
      const data = (await res.json()) as AuthUser;
      setUser(data);
    } catch (err) {
      setUser(null);
      setError(err instanceof Error ? err.message : 'Auth check failed');
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await fetch(`${apiBaseUrl}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // Ignore — cookies will be cleared by the backend regardless
    } finally {
      setUser(null);
    }
  };

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <AuthContext.Provider value={{ user, loading, error, refresh, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
