// Endpoints 6–8: leave requests.

import type { LeaveType } from '../../types';
import { addDays, addWorkingDays, todayKey, workingDaysBetween } from '../../../lib/dates';
import { nextId, type LeaveRequestRow, type MockDb } from '../db';
import { LEAVE_POLICY, holidaySet, leaveBalances, nowString, serializeLeaveRequest } from '../helpers';
import { HttpError, Validator, conflict, created, forbidden, isDate, notFound, ok, paginate, text, type Route } from '../http';

function assertEnoughDays(db: MockDb, r: Pick<LeaveRequestRow, 'employee_id' | 'type' | 'start_date' | 'days'>) {
  const balance = leaveBalances(db, r.employee_id, Number(r.start_date.slice(0, 4))).find((b) => b.type === r.type)!;
  if (r.days > balance.remaining_days) {
    throw new HttpError(422, 'INSUFFICIENT_BALANCE', `Only ${balance.remaining_days} ${balance.name.toLowerCase()} leave day(s) remaining.`);
  }
}

export const leaveRoutes: Route[] = [
  {
    method: 'GET',
    path: '/leave-requests',
    handler: ({ db, me, query }) => {
      const status = query.get('status');
      const from = query.get('from');
      const to = query.get('to');
      // Employees only ever see their own requests; HR may filter by employee.
      const employeeId = me.role === 'hr' ? Number(query.get('employee_id')) || null : me.id;
      const list = db.leave_requests
        .filter((r) => !employeeId || r.employee_id === employeeId)
        .filter((r) => !status || r.status === status)
        .filter((r) => (!from || r.end_date >= from) && (!to || r.start_date <= to));
      // HR's pending queue: oldest first. Everything else: newest first.
      list.sort((a, b) =>
        me.role === 'hr' && status === 'pending' ? a.start_date.localeCompare(b.start_date) : b.start_date.localeCompare(a.start_date),
      );
      return paginate(list.map((r) => serializeLeaveRequest(db, r)), query);
    },
  },

  {
    method: 'POST',
    path: '/leave-requests',
    handler: ({ db, me, body }) => {
      // 1. Fields.
      const v = new Validator();
      const type = text(body.type) as LeaveType;
      const policy = LEAVE_POLICY[type];
      v.check(!!policy, 'type', 'Choose annual or sick leave.');
      const start = v.required(body, 'start_date', 'start date');
      const end = v.required(body, 'end_date', 'end date');
      if (start && !isDate(start)) v.add('start_date', 'Enter a valid date.');
      if (end && !isDate(end)) v.add('end_date', 'Enter a valid date.');
      v.throwIfFailed();

      const today = todayKey();
      const holidays = holidaySet(db);
      // 2. Planned leave: at least `min_notice_days` working days ahead.
      const earliest = addWorkingDays(today, policy.min_notice_days, holidays);
      // 3. Unplanned leave: may start up to `max_backdate_days` in the past (0 = not in the past).
      const oldest = addDays(today, -policy.max_backdate_days);
      if (policy.min_notice_days > 0 && start < earliest) {
        v.add('start_date', `${policy.name} leave must be requested at least ${policy.min_notice_days} working days ahead (from ${earliest}).`);
      } else if (start < oldest) {
        v.add(
          'start_date',
          policy.max_backdate_days === 0
            ? 'The start date cannot be in the past.'
            : `${policy.name} leave can start at most ${policy.max_backdate_days} days in the past.`,
        );
      }
      // 4. The range itself.
      if (end < start) v.add('end_date', 'The end date must be on or after the start date.');
      else if (start.slice(0, 4) !== end.slice(0, 4)) v.add('end_date', 'Leave must start and end in the same year.');
      else if (workingDaysBetween(start, end, holidays) === 0) v.add('end_date', 'The selected dates contain no working days.');
      v.throwIfFailed();

      // 5. Overlap.
      const overlaps = db.leave_requests.some(
        (r) => r.employee_id === me.id && (r.status === 'pending' || r.status === 'approved') && r.start_date <= end && r.end_date >= start,
      );
      if (overlaps) throw new HttpError(422, 'OVERLAPPING_REQUEST', 'These dates overlap another pending or approved leave request.');

      // 6. Balance.
      const days = workingDaysBetween(start, end, holidays);
      assertEnoughDays(db, { employee_id: me.id, type, start_date: start, days });

      const request: LeaveRequestRow = {
        id: nextId(db.leave_requests),
        employee_id: me.id,
        type,
        start_date: start,
        end_date: end,
        days,
        reason: text(body.reason) || null,
        status: 'pending',
        reviewed_by: null,
        review_comment: null,
        reviewed_at: null,
        created_at: nowString(),
      };
      db.leave_requests.push(request);
      return created(serializeLeaveRequest(db, request));
    },
  },

  {
    method: 'PATCH',
    path: '/leave-requests/:id',
    handler: ({ db, me, body, params }) => {
      const request = db.leave_requests.find((r) => r.id === Number(params.id));
      const isOwner = request?.employee_id === me.id;
      // Employees can't even tell whether someone else's request exists.
      if (!request || (!isOwner && me.role !== 'hr')) throw notFound('Leave request');

      const status = text(body.status);
      const comment = text(body.comment);
      const v = new Validator();
      v.check(['approved', 'rejected', 'cancelled'].includes(status), 'status', 'Must be approved, rejected or cancelled.');
      if (status === 'rejected' && !comment) v.add('comment', 'The comment field is required.');
      v.throwIfFailed();

      if (status === 'cancelled') {
        if (!isOwner) throw forbidden('Only the employee can cancel their own leave.');
        const upcomingApproved = request.status === 'approved' && request.start_date > todayKey();
        if (request.status === 'approved' && !upcomingApproved) throw conflict('Leave that has already started cannot be cancelled. Please contact HR.');
        if (request.status !== 'pending' && !upcomingApproved) throw conflict(`A ${request.status} request cannot be cancelled.`);
        request.status = 'cancelled'; // approved days come back automatically
        return ok(serializeLeaveRequest(db, request));
      }

      // approved / rejected: HR only, never their own request.
      if (me.role !== 'hr') throw forbidden('Only HR can approve or reject leave.');
      if (isOwner) throw forbidden('You cannot review your own leave request.');
      if (request.status !== 'pending') throw conflict(`Only pending requests can be ${status}.`);
      if (status === 'approved') assertEnoughDays(db, request); // re-check: the balance may have changed

      Object.assign(request, { status, reviewed_by: me.id, review_comment: comment || null, reviewed_at: nowString() });
      return ok(serializeLeaveRequest(db, request));
    },
  },
];
