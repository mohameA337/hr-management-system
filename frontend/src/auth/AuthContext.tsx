import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, setUnauthorizedHandler, tokenStore } from '../api/client';
import type { Employee, LoginResult, Me } from '../api/types';

interface AuthState {
  user: Employee | null;
  /** True while restoring the session on page load. */
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isHr: boolean;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));

    if (!tokenStore.get()) {
      setLoading(false);
      return;
    }
    api
      .get<Me>('/me')
      .then((me) => setUser(me.user))
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await api.post<LoginResult>('/auth/login', { email, password });
    tokenStore.set(result.token);
    setUser(result.user);
  }, []);

  // No logout endpoint (API.md v3): forgetting the token logs out; it expires after 8 hours.
  const logout = useCallback(async () => {
    tokenStore.clear();
    setUser(null);
  }, []);

  const isHr = user?.role === 'hr';

  const value = useMemo(() => ({ user, loading, login, logout, isHr }), [user, loading, login, logout, isHr]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
