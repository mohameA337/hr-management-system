import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';

const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true';

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to={from} replace />;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setFieldErrors({});
    try {
      await login(email.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'VALIDATION_ERROR') {
        setFieldErrors(err.details);
      } else {
        setError(err instanceof ApiError ? err.message : 'Cannot reach the server. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login">
      <form className="card login__card" onSubmit={handleSubmit} noValidate>
        <h1 className="login__title">HR Management System</h1>
        <p className="muted">Sign in to continue</p>

        {error && (
          <div className="alert alert--error" role="alert">
            {error}
          </div>
        )}

        <label className="field">
          <span className="field__label">Email</span>
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={!!fieldErrors.email}
            autoFocus
          />
          {fieldErrors.email && <span className="field__error">{fieldErrors.email[0]}</span>}
        </label>

        <label className="field">
          <span className="field__label">Password</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={!!fieldErrors.password}
          />
          {fieldErrors.password && <span className="field__error">{fieldErrors.password[0]}</span>}
        </label>

        <button type="submit" className="btn btn--primary btn--block" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>

        {USE_MOCKS && (
          <p className="login__hint muted">
            Mock mode: <code>admin@hr.test</code>, <code>hr@hr.test</code>, <code>manager@hr.test</code> or{' '}
            <code>employee@hr.test</code> with password <code>password</code>.
          </p>
        )}
      </form>
    </div>
  );
}
