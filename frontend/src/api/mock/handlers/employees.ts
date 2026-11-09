// Endpoints 3–5: employees (HR only).

import type { Role } from '../../types';
import { nextId, type EmployeeRow } from '../db';
import { byName, fullName, serializeEmployee } from '../helpers';
import { Validator, conflict, created, has, isDate, notFound, nullableText, ok, paginate, text, type Ctx, type Route } from '../http';

const ROLES: Role[] = ['hr', 'employee'];
const TEXT_FIELDS = [
  ['first_name', 'first name'],
  ['last_name', 'last name'],
  ['job_title', 'job title'],
  ['department', 'department'],
] as const;

/** Validates POST (everything required) and PATCH (only the fields sent). */
function validate(ctx: Ctx, existing: EmployeeRow | null): EmployeeRow {
  const { db, body } = ctx;
  const v = new Validator();
  const next: EmployeeRow = existing
    ? { ...existing }
    : {
        id: 0, employee_code: '', first_name: '', last_name: '', email: '', phone: null, job_title: '', department: '',
        hire_date: '', status: 'active', termination_date: null, role: 'employee', password: '', last_login_at: null,
      };
  const touched = (field: string) => !existing || has(body, field);

  if (!existing) next.employee_code = v.required(body, 'employee_code', 'employee code').toUpperCase();
  for (const [field, label] of TEXT_FIELDS) {
    if (touched(field)) next[field] = v.required(body, field, label);
  }
  if (touched('email')) {
    next.email = v.required(body, 'email', 'email').toLowerCase();
    if (next.email) v.check(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next.email), 'email', 'Enter a valid email address.');
  }
  if (has(body, 'phone')) next.phone = nullableText(body.phone);
  if (touched('hire_date')) {
    next.hire_date = v.required(body, 'hire_date', 'hire date');
    if (next.hire_date) v.check(isDate(next.hire_date), 'hire_date', 'Enter a valid date.');
  }
  if (touched('role')) {
    next.role = text(body.role) as Role;
    v.check(ROLES.includes(next.role), 'role', 'Choose HR or Employee.');
  }
  // Required when adding; optional when editing (resets the password).
  if (!existing || text(body.password)) {
    next.password = typeof body.password === 'string' ? body.password : '';
    v.check(next.password.length >= 8, 'password', 'The password must be at least 8 characters.');
  }
  if (existing && has(body, 'status')) {
    v.check(body.status === 'active' || body.status === 'terminated', 'status', 'Must be active or terminated.');
    if (body.status === 'terminated') {
      const date = v.required(body, 'termination_date', 'termination date');
      if (date) v.check(isDate(date) && date >= next.hire_date, 'termination_date', 'Enter a valid date on or after the hire date.');
      next.status = 'terminated';
      next.termination_date = date;
    }
  }
  v.throwIfFailed();

  const self = existing?.id === ctx.me.id;
  if (self && next.role !== existing.role) throw conflict('You cannot change your own role.');
  if (existing && body.status !== undefined && body.status !== existing.status) {
    if (self) throw conflict('You cannot terminate your own account.');
    if (existing.status === 'terminated') throw conflict('A terminated employee cannot be changed back to active.');
  }
  const others = db.employees.filter((e) => e.id !== existing?.id);
  if (others.some((e) => e.employee_code === next.employee_code)) throw conflict('An employee with this employee code already exists.');
  if (others.some((e) => e.email === next.email)) throw conflict('An employee with this email already exists.');
  return next;
}

export const employeeRoutes: Route[] = [
  {
    method: 'GET',
    path: '/employees',
    hrOnly: true,
    handler: ({ db, query }) => {
      const search = (query.get('search') ?? '').toLowerCase();
      const status = query.get('status') || 'active';
      const list = db.employees
        .filter((e) => status === 'all' || e.status === status)
        .filter((e) => !search || [fullName(e), e.email, e.employee_code].some((s) => s.toLowerCase().includes(search)))
        .sort(byName)
        .map(serializeEmployee);
      return paginate(list, query);
    },
  },
  {
    method: 'POST',
    path: '/employees',
    hrOnly: true,
    handler: (ctx) => {
      const employee = { ...validate(ctx, null), id: nextId(ctx.db.employees) };
      ctx.db.employees.push(employee);
      return created(serializeEmployee(employee));
    },
  },
  {
    method: 'PATCH',
    path: '/employees/:id',
    hrOnly: true,
    handler: (ctx) => {
      const { db } = ctx;
      const employee = db.employees.find((e) => e.id === Number(ctx.params.id));
      if (!employee) throw notFound('Employee');
      const terminating = employee.status === 'active' && ctx.body.status === 'terminated';
      const next = validate(ctx, employee);

      // In PHP all of this is one transaction.
      Object.assign(employee, next);
      if (terminating) {
        db.auth_tokens = db.auth_tokens.filter((t) => t.employee_id !== employee.id); // log them out
        for (const r of db.leave_requests.filter((r) => r.employee_id === employee.id)) {
          if (r.status === 'pending' || (r.status === 'approved' && r.start_date > employee.termination_date!)) {
            Object.assign(r, { status: 'cancelled', review_comment: 'Cancelled automatically: employee terminated.' });
          }
        }
      }
      return ok(serializeEmployee(employee));
    },
  },
];
