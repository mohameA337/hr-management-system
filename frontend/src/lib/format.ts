import { parseDateKey } from './dates';

export function formatDate(key: string | null | undefined): string {
  if (!key) return '—';
  return parseDateKey(key).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDays(days: number): string {
  return `${days} ${days === 1 ? 'day' : 'days'}`;
}

/** 'on_leave' → 'On leave'. */
export function humanize(value: string): string {
  const text = value.replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export const ROLE_LABELS = { hr: 'HR', employee: 'Employee' } as const;

export const LEAVE_TYPE_LABELS = { annual: 'Annual', sick: 'Sick' } as const;
