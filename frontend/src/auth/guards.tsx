import { Navigate, Outlet, useLocation } from 'react-router';
import type { Role } from '../api/types';
import { useAuth } from './AuthContext';
import { ForbiddenPage } from '../pages/ErrorPages';

/** Only logged-in users; others are sent to /login and brought back afterwards. */
export function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="page-loading">Loading…</div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return <Outlet />;
}

/** Only the given roles. The backend checks roles too — this only hides screens. */
export function RequireRole({ roles }: { roles: Role[] }) {
  const { hasRole } = useAuth();
  return hasRole(...roles) ? <Outlet /> : <ForbiddenPage />;
}
