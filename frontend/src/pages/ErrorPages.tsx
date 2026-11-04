import { Link } from 'react-router';

export function NotFoundPage() {
  return (
    <div className="card error-page">
      <h1 className="page-title">Page not found</h1>
      <p className="muted">The page you are looking for does not exist.</p>
      <Link to="/">Back to dashboard</Link>
    </div>
  );
}

export function ForbiddenPage() {
  return (
    <div className="card error-page">
      <h1 className="page-title">Access denied</h1>
      <p className="muted">Your role does not have access to this page.</p>
      <Link to="/">Back to dashboard</Link>
    </div>
  );
}
