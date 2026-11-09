// Small presentational building blocks used by every page.

import type { ReactNode } from 'react';
import { Link } from 'react-router';
import type { PaginationMeta } from '../api/types';
import { errorMessage } from '../lib/errors';
import { humanize } from '../lib/format';

export function PageHeader({
  title,
  subtitle,
  actions,
  back,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  back?: { to: string; label: string };
}) {
  return (
    <div className="page-header">
      <div>
        {back && (
          <Link to={back.to} className="page-header__back">
            ← {back.label}
          </Link>
        )}
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-header__subtitle muted">{subtitle}</p>}
      </div>
      {actions && <div className="page-header__actions">{actions}</div>}
    </div>
  );
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return <div className="state">{label}</div>;
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className="state state--error" role="alert">
      <p>{errorMessage(error)}</p>
      {onRetry && (
        <button type="button" className="btn btn--ghost btn--sm" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="state">{children}</div>;
}

/** Renders loading / error / content for a useApi() result. */
export function AsyncBlock<T>({
  state,
  children,
}: {
  state: { data: T | null; loading: boolean; error: unknown; reload: () => void };
  children: (data: T) => ReactNode;
}) {
  if (state.error && !state.data) return <ErrorState error={state.error} onRetry={state.reload} />;
  if (state.data === null) return <Loading />;
  return <>{children(state.data)}</>;
}

const BADGE_TONES: Record<string, string> = {
  active: 'success',
  approved: 'success',
  pending: 'warning',
  rejected: 'danger',
  terminated: 'danger',
  cancelled: 'neutral',
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return <span className={`badge badge--${BADGE_TONES[status] ?? 'info'}`}>{label ?? humanize(status)}</span>;
}

export function StatCard({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: string }) {
  return (
    <div className={`stat ${tone ? `stat--${tone}` : ''}`}>
      <div className="stat__label">{label}</div>
      <div className="stat__value">{value}</div>
      {hint && <div className="stat__hint">{hint}</div>}
    </div>
  );
}

export function Tabs<K extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: { key: K; label: ReactNode }[];
  active: K;
  onChange: (key: K) => void;
}) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          role="tab"
          aria-selected={tab.key === active}
          className={`tabs__tab ${tab.key === active ? 'tabs__tab--active' : ''}`}
          onClick={() => onChange(tab.key)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function Pagination({ meta, onChange }: { meta: PaginationMeta; onChange: (page: number) => void }) {
  if (meta.total === 0) return null;
  const first = (meta.page - 1) * meta.per_page + 1;
  const last = Math.min(meta.total, meta.page * meta.per_page);
  return (
    <div className="pagination">
      <span className="muted">
        {first}–{last} of {meta.total}
      </span>
      <div className="pagination__buttons">
        <button type="button" className="btn btn--ghost btn--sm" disabled={meta.page <= 1} onClick={() => onChange(meta.page - 1)}>
          Previous
        </button>
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          disabled={meta.page >= meta.total_pages}
          onClick={() => onChange(meta.page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}

export function Field({
  label,
  error,
  hint,
  required,
  children,
  wide,
}: {
  label: string;
  error?: string;
  hint?: ReactNode;
  required?: boolean;
  children: ReactNode;
  /** Span both columns in a .form-grid. */
  wide?: boolean;
}) {
  return (
    <label className={`field ${wide ? 'field--wide' : ''}`}>
      <span className="field__label">
        {label}
        {required && <span className="field__required"> *</span>}
      </span>
      {children}
      {hint && !error && <span className="field__hint">{hint}</span>}
      {error && <span className="field__error">{error}</span>}
    </label>
  );
}

export function FormAlert({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="alert alert--error" role="alert">
      {message}
    </div>
  );
}
