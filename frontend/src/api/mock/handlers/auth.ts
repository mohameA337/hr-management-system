// Endpoints 1–2: login and "me".

import { toDateTimeString } from '../../../lib/dates';
import { currentYear, leaveBalances, nowString, serializeEmployee } from '../helpers';
import { HttpError, Validator, ok, type Route } from '../http';

export const authRoutes: Route[] = [
  {
    method: 'POST',
    path: '/auth/login',
    public: true,
    handler: ({ db, body }) => {
      const v = new Validator();
      const email = v.required(body, 'email', 'email').toLowerCase();
      const password = typeof body.password === 'string' ? body.password : '';
      if (!password) v.add('password', 'The password field is required.');
      v.throwIfFailed();

      const employee = db.employees.find((e) => e.email.toLowerCase() === email);
      // Same message for unknown email, wrong password and terminated employee.
      if (!employee || employee.status !== 'active' || employee.password !== password) {
        throw new HttpError(401, 'UNAUTHENTICATED', 'Invalid email or password.');
      }

      const token = (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, '');
      db.auth_tokens.push({ token, employee_id: employee.id });
      employee.last_login_at = nowString();
      return ok({
        token,
        expires_at: toDateTimeString(new Date(Date.now() + 8 * 60 * 60 * 1000)),
        user: serializeEmployee(employee),
      });
    },
  },

  {
    method: 'GET',
    path: '/me',
    handler: ({ db, me }) => ok({ user: serializeEmployee(me), leave_balances: leaveBalances(db, me.id, currentYear()) }),
  },
];
