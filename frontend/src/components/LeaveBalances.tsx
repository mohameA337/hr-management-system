import type { LeaveBalance } from '../api/types';
import { StatCard } from './ui';

export function LeaveBalances({ balances }: { balances: LeaveBalance[] }) {
  return (
    <div className="stats">
      {balances.map((b) => (
        <StatCard
          key={b.type}
          label={`${b.name} leave ${b.year}`}
          value={`${b.remaining_days} days left`}
          hint={`${b.used_days} used of ${b.days_per_year}`}
          tone={b.remaining_days === 0 ? 'danger' : undefined}
        />
      ))}
    </div>
  );
}
