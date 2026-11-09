import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { api } from '../api/client';
import type { LeaveRequest, LeaveStatus, Paginated } from '../api/types';
import { LeaveRequestTable } from '../components/LeaveRequestTable';
import { FormModal } from '../components/Modal';
import { useToast } from '../components/Toast';
import { AsyncBlock, Field, PageHeader, Pagination, Tabs } from '../components/ui';
import { useAuth } from '../auth/AuthContext';
import { useApi } from '../hooks/useApi';
import { useSubmit } from '../hooks/useSubmit';
import { LEAVE_TYPE_LABELS, formatDate, formatDays } from '../lib/format';

type View = 'pending' | 'all';

/** HR: everyone's leave. `?employee_id=…&name=…` (from the Employees page) shows one employee's history. */
export function LeaveRequestsPage() {
  const [params, setParams] = useSearchParams();
  const employeeId = params.get('employee_id');
  const employeeName = params.get('name');
  const [view, setView] = useState<View>(employeeId ? 'all' : 'pending');

  return (
    <>
      <PageHeader
        title="Leave requests"
        subtitle={
          employeeId && (
            <>
              Showing {employeeName ?? 'one employee'} only ·{' '}
              <button type="button" className="link-button" onClick={() => setParams({})}>
                show everyone
              </button>
            </>
          )
        }
      />
      <Tabs<View>
        tabs={[
          { key: 'pending', label: 'Waiting for approval' },
          { key: 'all', label: 'All requests' },
        ]}
        active={view}
        onChange={setView}
      />
      <div className="tab-panel">
        <RequestList key={`${view}-${employeeId}`} pendingOnly={view === 'pending'} employeeId={employeeId} />
      </div>
    </>
  );
}

function RequestList({ pendingOnly, employeeId }: { pendingOnly: boolean; employeeId: string | null }) {
  const { user } = useAuth();
  const [status, setStatus] = useState<'' | LeaveStatus>('');
  const [page, setPage] = useState(1);
  const [reviewing, setReviewing] = useState<{ request: LeaveRequest; action: 'approved' | 'rejected' } | null>(null);
  const requests = useApi(
    () =>
      api.list<Paginated<LeaveRequest>>('/leave-requests', {
        status: pendingOnly ? 'pending' : status,
        employee_id: employeeId,
        page,
      }),
    [pendingOnly, status, employeeId, page],
  );

  return (
    <section className="card card--flush">
      {!pendingOnly && (
        <div className="toolbar">
          <select
            className="select"
            aria-label="Status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as '' | LeaveStatus);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      )}
      <AsyncBlock state={requests}>
        {(result) => (
          <>
            <LeaveRequestTable
              requests={result.data}
              showEmployee
              empty={pendingOnly ? 'Nothing waiting for approval.' : 'No leave requests match these filters.'}
              actions={(request) =>
                request.status === 'pending' &&
                (request.employee.id === user?.id ? (
                  <span className="muted small">Another HR person must review this</span>
                ) : (
                  <>
                    <button type="button" className="btn btn--primary btn--sm" onClick={() => setReviewing({ request, action: 'approved' })}>
                      Approve
                    </button>
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => setReviewing({ request, action: 'rejected' })}>
                      Reject
                    </button>
                  </>
                ))
              }
            />
            <Pagination meta={result.meta} onChange={setPage} />
          </>
        )}
      </AsyncBlock>
      {reviewing && <ReviewModal {...reviewing} onClose={() => setReviewing(null)} onDone={requests.reload} />}
    </section>
  );
}

function ReviewModal({
  request,
  action,
  onClose,
  onDone,
}: {
  request: LeaveRequest;
  action: 'approved' | 'rejected';
  onClose: () => void;
  onDone: () => void;
}) {
  const [comment, setComment] = useState('');
  const { submitting, errors, run } = useSubmit();
  const toast = useToast();
  const approving = action === 'approved';

  const save = async () => {
    if (await run(() => api.patch(`/leave-requests/${request.id}`, { status: action, comment }))) {
      toast.success(approving ? 'Leave request approved.' : 'Leave request rejected.');
      onDone();
      onClose();
    }
  };

  return (
    <FormModal
      title={approving ? 'Approve leave' : 'Reject leave'}
      submitLabel={approving ? 'Approve' : 'Reject'}
      danger={!approving}
      onClose={onClose}
      onSubmit={() => void save()}
      submitting={submitting}
      formError={errors.message}
    >
      <p className="confirm-message">
        <strong>{request.employee.full_name}</strong> — {LEAVE_TYPE_LABELS[request.type].toLowerCase()} leave,{' '}
        {formatDate(request.start_date)}
        {request.end_date !== request.start_date && ` – ${formatDate(request.end_date)}`} ({formatDays(request.days)})
        {request.reason && (
          <>
            <br />
            <span className="muted">“{request.reason}”</span>
          </>
        )}
      </p>
      <Field label={approving ? 'Comment (optional)' : 'Reason for rejecting'} error={errors.fields.comment} required={!approving}>
        <textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} />
      </Field>
    </FormModal>
  );
}
