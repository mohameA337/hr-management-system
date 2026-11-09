import { Navigate, Outlet, useLocation } from 'react-router';
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

/** HR only. The backend checks the role too — this only hides screens. */
export function RequireHr() {
  const { user } = useAuth();
  return user?.role === 'hr' ? <Outlet /> : <ForbiddenPage />;
}
