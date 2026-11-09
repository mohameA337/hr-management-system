// The leave policy, row → API object conversion and the remaining-days calculation — the same pieces the
// PHP backend needs.

import type { Employee, EmployeeSummary, LeaveBalance, LeaveRequest, LeaveType } from '../types';
import { toDateTimeString, todayKey } from '../../lib/dates';
import type { EmployeeRow, LeaveRequestRow, MockDb } from './db';

/** LEAVE-1: fixed in the code (in PHP, e.g. a constant array). */
export const LEAVE_POLICY: Record<LeaveType, { name: string; days_per_year: number; min_notice_days: number; max_backdate_days: number }> = {
  annual: { name: 'Annual', days_per_year: 21, min_notice_days: 3, max_backdate_days: 0 }, // planned
  sick: { name: 'Sick', days_per_year: 10, min_notice_days: 0, max_backdate_days: 7 }, // unplanned
};

export const fullName = (e: EmployeeRow) => `${e.first_name} ${e.last_name}`;
export const nowString = () => toDateTimeString(new Date());
export const currentYear = () => Number(todayKey().slice(0, 4));

export function toSummary(e: EmployeeRow): EmployeeSummary {
  return { id: e.id, employee_code: e.employee_code, full_name: fullName(e) };
}

function summaryById(db: MockDb, id: number | null): EmployeeSummary | null {
  const employee = id === null ? undefined : db.employees.find((e) => e.id === id);
  return employee ? toSummary(employee) : null;
}

export const byName = (a: EmployeeRow, b: EmployeeRow) =>
  a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name);

export function serializeEmployee(e: EmployeeRow): Employee {
  // Never include the password.
  return {
    id: e.id,
    employee_code: e.employee_code,
    first_name: e.first_name,
    last_name: e.last_name,
    full_name: fullName(e),
    email: e.email,
    phone: e.phone,
    job_title: e.job_title,
    department: e.department,
    hire_date: e.hire_date,
    status: e.status,
    termination_date: e.termination_date,
    role: e.role,
    last_login_at: e.last_login_at,
  };
}

export function serializeLeaveRequest(db: MockDb, r: LeaveRequestRow): LeaveRequest {
  return {
    id: r.id,
    employee: summaryById(db, r.employee_id)!,
    type: r.type,
    start_date: r.start_date,
    end_date: r.end_date,
    days: r.days,
    reason: r.reason,
    status: r.status,
    reviewer: summaryById(db, r.reviewed_by),
    review_comment: r.review_comment,
    reviewed_at: r.reviewed_at,
    created_at: r.created_at,
  };
}

/** All holiday dates, for counting working days. */
export function holidaySet(db: MockDb): Set<string> {
  return new Set(db.public_holidays.map((h) => h.holiday_date));
}

/** LEAVE-2: days per year − approved days in that calendar year. Nothing is stored. */
export function leaveBalances(db: MockDb, employeeId: number, year: number): LeaveBalance[] {
  return (Object.keys(LEAVE_POLICY) as LeaveType[]).map((type) => {
    const policy = LEAVE_POLICY[type];
    const used = db.leave_requests
      .filter((r) => r.employee_id === employeeId && r.type === type && r.status === 'approved')
      .filter((r) => Number(r.start_date.slice(0, 4)) === year)
      .reduce((sum, r) => sum + r.days, 0);
    return { type, ...policy, year, used_days: used, remaining_days: policy.days_per_year - used };
  });
}
