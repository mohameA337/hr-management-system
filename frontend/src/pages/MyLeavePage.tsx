import { useState } from 'react';
import { api } from '../api/client';
import type { LeaveBalance, LeaveRequest, LeaveStatus, LeaveType, Me, Paginated } from '../api/types';
import { LeaveBalances } from '../components/LeaveBalances';
import { LeaveRequestTable } from '../components/LeaveRequestTable';
import { ConfirmDialog, FormModal } from '../components/Modal';
import { useToast } from '../components/Toast';
import { AsyncBlock, Field, PageHeader, Pagination, Tabs } from '../components/ui';
import { useApi } from '../hooks/useApi';
import { useHolidays } from '../hooks/useOptions';
import { useSubmit } from '../hooks/useSubmit';
import { addDays, addWorkingDays, eachDay, isWeekend, todayKey, workingDaysBetween } from '../lib/dates';
import { LEAVE_TYPE_LABELS, formatDate, formatDays } from '../lib/format';

type StatusTab = 'all' | LeaveStatus;

export function MyLeavePage() {
  const me = useApi(() => api.get<Me>('/me'), []);
  const [status, setStatus] = useState<StatusTab>('all');
  const [page, setPage] = useState(1);
  const requests = useApi(
    () => api.list<Paginated<LeaveRequest>>('/leave-requests', { status: status === 'all' ? undefined : status, page }),
    [status, page],
  );
  const [requesting, setRequesting] = useState(false);
  const [cancelling, setCancelling] = useState<LeaveRequest | null>(null);
  const toast = useToast();

  const refresh = () => {
    me.reload();
    requests.reload();
  };

  return (
    <>
      <PageHeader
        title="My leave"
        subtitle="Leave days reset every calendar year — unused days do not carry over."
        actions={
          <button type="button" className="btn btn--primary" onClick={() => setRequesting(true)} disabled={!me.data}>
            Request leave
          </button>
        }
      />

      <AsyncBlock state={me}>{(data) => <LeaveBalances balances={data.leave_balances} />}</AsyncBlock>

      <section className="card card--flush">
        <div className="card__toolbar">
          <Tabs<StatusTab>
            tabs={[
              { key: 'all', label: 'All' },
              { key: 'pending', label: 'Pending' },
              { key: 'approved', label: 'Approved' },
              { key: 'rejected', label: 'Rejected' },
              { key: 'cancelled', label: 'Cancelled' },
            ]}
            active={status}
            onChange={(tab) => {
              setStatus(tab);
              setPage(1);
            }}
          />
        </div>
        <AsyncBlock state={requests}>
          {(result) => (
            <>
              <LeaveRequestTable
                requests={result.data}
                empty="You have no leave requests here."
                actions={(request) =>
                  canCancel(request) && (
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => setCancelling(request)}>
                      Cancel
                    </button>
                  )
                }
              />
              <Pagination meta={result.meta} onChange={setPage} />
            </>
          )}
        </AsyncBlock>
      </section>

      {requesting && me.data && (
        <RequestLeaveModal
          balances={me.data.leave_balances}
          onClose={() => setRequesting(false)}
          onSaved={() => {
            toast.success('Leave request submitted. HR will review it.');
            refresh();
          }}
        />
      )}
      {cancelling && (
        <ConfirmDialog
          title="Cancel leave"
          message={
            cancelling.status === 'approved'
              ? `Cancel your approved ${LEAVE_TYPE_LABELS[cancelling.type].toLowerCase()} leave from ${formatDate(cancelling.start_date)}? The ${formatDays(cancelling.days)} go back to your balance.`
              : `Cancel your ${LEAVE_TYPE_LABELS[cancelling.type].toLowerCase()} leave request from ${formatDate(cancelling.start_date)}?`
          }
          confirmLabel="Cancel leave"
          danger
          onClose={() => setCancelling(null)}
          onConfirm={async () => {
            await api.patch(`/leave-requests/${cancelling.id}`, { status: 'cancelled' });
            setCancelling(null);
            toast.success('Leave cancelled.');
            refresh();
          }}
        />
      )}
    </>
  );
}

/** Pending requests, and approved leave that has not started yet. */
function canCancel(request: LeaveRequest): boolean {
  return request.status === 'pending' || (request.status === 'approved' && request.start_date > todayKey());
}

/** The earliest first day a leave type allows. */
function earliestStart(rules: LeaveBalance, holidays: ReadonlySet<string>): string {
  const today = todayKey();
  return rules.min_notice_days > 0 ? addWorkingDays(today, rules.min_notice_days, holidays) : addDays(today, -rules.max_backdate_days);
}

function ruleHint(rules: LeaveBalance): string {
  if (rules.min_notice_days > 0) return `Planned leave: request at least ${rules.min_notice_days} working days ahead.`;
  if (rules.max_backdate_days > 0) return `Unplanned leave: can start today or up to ${rules.max_backdate_days} days in the past.`;
  return 'Cannot start in the past.';
}

function RequestLeaveModal({
  balances,
  onClose,
  onSaved,
}: {
  balances: LeaveBalance[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const holidayList = useHolidays();
  const holidays = new Set(holidayList.data?.map((h) => h.holiday_date));
  const [type, setType] = useState<LeaveType | ''>('');
  const [start, setStart] = useState(addDays(todayKey(), 1));
  const [end, setEnd] = useState(addDays(todayKey(), 1));
  const [reason, setReason] = useState('');
  const { submitting, errors, run, clearField } = useSubmit();

  // Each balance also carries its type's rules (API.md).
  const rules = balances.find((b) => b.type === type);
  const valid = start && end && end >= start;
  const days = valid ? workingDaysBetween(start, end, holidays) : 0;
  const holidaysInRange = valid ? (holidayList.data ?? []).filter((h) => h.holiday_date >= start && h.holiday_date <= end && !isWeekend(h.holiday_date)) : [];
  const weekendDays = valid ? eachDay(start, end).filter(isWeekend).length : 0;
  const excluded = [weekendDays > 0 && `${weekendDays} weekend ${weekendDays === 1 ? 'day' : 'days'}`, ...holidaysInRange.map((h) => h.name)].filter(Boolean);

  const chooseType = (value: LeaveType | '') => {
    setType(value);
    clearField('type');
    clearField('start_date');
    const chosen = balances.find((b) => b.type === value);
    if (!chosen) return;
    // Jump to a valid first day: planned leave to the earliest allowed day, unplanned leave to today.
    const first = chosen.min_notice_days > 0 ? earliestStart(chosen, holidays) : todayKey();
    if (chosen.min_notice_days > 0 ? start < first : start !== first) {
      setStart(first);
      if (end < first) setEnd(first);
    }
  };

  const save = async () => {
    if (await run(() => api.post('/leave-requests', { type: type || null, start_date: start, end_date: end, reason }))) {
      onSaved();
      onClose();
    }
  };

  return (
    <FormModal title="Request leave" submitLabel="Submit request" onClose={onClose} onSubmit={() => void save()} submitting={submitting} formError={errors.message}>
      <Field label="Leave type" error={errors.fields.type} hint={rules && ruleHint(rules)} required>
        <select value={type} onChange={(e) => chooseType(e.target.value as LeaveType | '')}>
          <option value="">Choose…</option>
          {balances.map((b) => (
            <option key={b.type} value={b.type}>
              {b.name} ({b.min_notice_days > 0 ? 'planned' : 'unplanned'})
            </option>
          ))}
        </select>
      </Field>
      <div className="form-grid">
        <Field label="First day" error={errors.fields.start_date} required>
          <input
            type="date"
            value={start}
            min={rules ? earliestStart(rules, holidays) : undefined}
            onChange={(e) => {
              setStart(e.target.value);
              clearField('start_date');
              if (end < e.target.value) setEnd(e.target.value);
            }}
          />
        </Field>
        <Field label="Last day" error={errors.fields.end_date} required>
          <input
            type="date"
            value={end}
            min={start}
            onChange={(e) => {
              setEnd(e.target.value);
              clearField('end_date');
            }}
          />
        </Field>
      </div>
      <p className="form-summary">
        <strong>{formatDays(days)} of leave</strong>
        {rules && <span className={days > rules.remaining_days ? 'text-danger' : 'muted'}> · {rules.remaining_days} days available</span>}
        {excluded.length > 0 && (
          <>
            <br />
            <span className="muted small">Not counted: {excluded.join(', ')}</span>
          </>
        )}
      </p>
      <Field label="Reason" error={errors.fields.reason}>
        <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
    </FormModal>
  );
}
