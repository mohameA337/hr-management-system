import { Link } from 'react-router';
import { api } from '../api/client';
import type { Employee, Holiday, LeaveRequest, Me, Paginated } from '../api/types';
import { LeaveBalances } from '../components/LeaveBalances';
import { LeaveRequestTable } from '../components/LeaveRequestTable';
import { AsyncBlock, EmptyState, PageHeader, StatCard } from '../components/ui';
import { useAuth } from '../auth/AuthContext';
import { useApi } from '../hooks/useApi';
import { useHolidays } from '../hooks/useOptions';
import { parseDateKey, todayKey } from '../lib/dates';
import { LEAVE_TYPE_LABELS, formatDate } from '../lib/format';

// There is no dashboard endpoint: the dashboard is built from the list endpoints.
export function DashboardPage() {
  const { user, isHr } = useAuth();
  return (
    <>
      <PageHeader title={`Welcome, ${user?.first_name}`} subtitle={formatDate(todayKey())} />
      {isHr ? <HrView /> : <EmployeeView />}
    </>
  );
}

function HrView() {
  const today = todayKey();
  const employees = useApi(() => api.list<Paginated<Employee>>('/employees', { per_page: 1 }), []);
  const pending = useApi(() => api.list<Paginated<LeaveRequest>>('/leave-requests', { status: 'pending', per_page: 5 }), []);
  const onLeave = useApi(
    () => api.list<Paginated<LeaveRequest>>('/leave-requests', { status: 'approved', from: today, to: today, per_page: 100 }),
    [today],
  );

  return (
    <>
      <div className="stats">
        <StatCard label="Active employees" value={<Link to="/employees">{employees.data?.meta.total ?? '…'}</Link>} />
        <StatCard label="On leave today" value={onLeave.data?.meta.total ?? '…'} tone="info" />
        <StatCard label="Waiting for approval" value={<Link to="/leave-requests">{pending.data?.meta.total ?? '…'}</Link>} tone="warning" />
      </div>

      <section className="card card--flush section">
        <div className="card__toolbar">
          <h2 className="card__title">Waiting for approval</h2>
          <Link to="/leave-requests" className="btn btn--ghost btn--sm">
            Review all
          </Link>
        </div>
        <AsyncBlock state={pending}>
          {(result) => <LeaveRequestTable requests={result.data} showEmployee empty="Nothing waiting for approval." />}
        </AsyncBlock>
      </section>

      <div className="grid-2">
        <section className="card">
          <h2 className="card__title">On leave today</h2>
          <AsyncBlock state={onLeave}>
            {(result) =>
              result.data.length === 0 ? (
                <EmptyState>Everyone is in today.</EmptyState>
              ) : (
                <div className="balance-list">
                  {result.data.map((r) => (
                    <div key={r.id} className="balance-list__item">
                      <span>{r.employee.full_name}</span>
                      <span className="muted">
                        {LEAVE_TYPE_LABELS[r.type]} · until {formatDate(r.end_date)}
                      </span>
                    </div>
                  ))}
                </div>
              )
            }
          </AsyncBlock>
        </section>
        <UpcomingHolidays />
      </div>
    </>
  );
}

function EmployeeView() {
  const me = useApi(() => api.get<Me>('/me'), []);
  const recent = useApi(() => api.list<Paginated<LeaveRequest>>('/leave-requests', { per_page: 5 }), []);
  return (
    <>
      <AsyncBlock state={me}>{(data) => <LeaveBalances balances={data.leave_balances} />}</AsyncBlock>
      <section className="card card--flush section">
        <div className="card__toolbar">
          <h2 className="card__title">My latest leave requests</h2>
          <Link to="/my-leave" className="btn btn--primary btn--sm">
            Request leave
          </Link>
        </div>
        <AsyncBlock state={recent}>
          {(result) => <LeaveRequestTable requests={result.data} empty="You have not requested any leave yet." />}
        </AsyncBlock>
      </section>
      <div className="grid-2">
        <UpcomingHolidays />
      </div>
    </>
  );
}

function UpcomingHolidays() {
  const holidays = useHolidays();
  return (
    <section className="card">
      <h2 className="card__title">Upcoming public holidays</h2>
      <AsyncBlock state={holidays}>
        {(list) => {
          const upcoming: Holiday[] = list.filter((h) => h.holiday_date >= todayKey()).slice(0, 3);
          return upcoming.length === 0 ? (
            <EmptyState>No upcoming holidays.</EmptyState>
          ) : (
            <div className="balance-list">
              {upcoming.map((h) => (
                <div key={h.id} className="balance-list__item">
                  <span>{h.name}</span>
                  <span className="muted">
                    {parseDateKey(h.holiday_date).toLocaleDateString('en-US', { weekday: 'short' })}, {formatDate(h.holiday_date)}
                  </span>
                </div>
              ))}
            </div>
          );
        }}
      </AsyncBlock>
      <Link to="/holidays" className="btn btn--ghost btn--sm">
        All holidays
      </Link>
    </section>
  );
}
