import type { ReactNode } from 'react';
import type { LeaveRequest } from '../api/types';
import { LEAVE_TYPE_LABELS, formatDate, formatDays } from '../lib/format';
import { EmptyState, StatusBadge } from './ui';

export function LeaveRequestTable({
  requests,
  showEmployee,
  actions,
  empty = 'No leave requests.',
}: {
  requests: LeaveRequest[];
  showEmployee?: boolean;
  actions?: (request: LeaveRequest) => ReactNode;
  empty?: string;
}) {
  if (requests.length === 0) return <EmptyState>{empty}</EmptyState>;

  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            {showEmployee && <th>Employee</th>}
            <th>Type</th>
            <th>Dates</th>
            <th>Days</th>
            <th>Status</th>
            <th>Notes</th>
            {actions && <th className="table__actions-head">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {requests.map((request) => (
            <tr key={request.id}>
              {showEmployee && (
                <td>
                  <div>{request.employee.full_name}</div>
                  <div className="muted small">{request.employee.employee_code}</div>
                </td>
              )}
              <td>{LEAVE_TYPE_LABELS[request.type]}</td>
              <td className="nowrap">
                {formatDate(request.start_date)}
                {request.end_date !== request.start_date && <> – {formatDate(request.end_date)}</>}
              </td>
              <td className="nowrap">{formatDays(request.days)}</td>
              <td>
                <StatusBadge status={request.status} />
              </td>
              <td className="table__notes">
                {request.reason && <div>{request.reason}</div>}
                {request.review_comment && (
                  <div className="muted small">
                    {request.reviewer?.full_name}: “{request.review_comment}”
                  </div>
                )}
              </td>
              {actions && <td className="table__actions">{actions(request)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
