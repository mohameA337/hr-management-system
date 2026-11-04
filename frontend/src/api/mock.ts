// Development-only fake backend, enabled with VITE_USE_MOCKS=true.
// Returns exactly the shapes from docs/API.md so screens can be built before the PHP endpoints exist.
// Each module adds its handlers here; delete them once the real endpoint works.

import type { RawResponse } from './client';
import type { Role, User } from './types';

const MOCK_PASSWORD = 'password';

const users: Record<Role, User> = {
  admin: mockUser(1, 'admin', 'EMP-0001', 'Adam Admin', 'admin@hr.test'),
  hr: mockUser(2, 'hr', 'EMP-0002', 'Mona Adel', 'hr@hr.test'),
  manager: mockUser(3, 'manager', 'EMP-0004', 'Omar Hassan', 'manager@hr.test'),
  employee: mockUser(4, 'employee', 'EMP-0012', 'Sara Ali', 'employee@hr.test'),
};

function mockUser(id: number, role: Role, code: string, name: string, email: string): User {
  return {
    id,
    role,
    is_active: true,
    last_login_at: '2026-11-04 08:58:02',
    employee: { id, employee_code: code, full_name: name, email },
  };
}

const ok = (data: unknown, status = 200): RawResponse => ({ status, body: { data } });
const noContent = (): RawResponse => ({ status: 204, body: null });
const fail = (status: number, code: string, message: string, details?: Record<string, string[]>): RawResponse => ({
  status,
  body: { error: { code, message, ...(details ? { details } : {}) } },
});

function currentUser(token: string | null): User | null {
  const role = token?.startsWith('mock-token-') ? (token.slice('mock-token-'.length) as Role) : null;
  return role && users[role] ? users[role] : null;
}

export async function mockRequest(method: string, url: string, body: unknown, token: string | null): Promise<RawResponse> {
  await new Promise((resolve) => setTimeout(resolve, 300)); // feel like a network call
  const path = url.split('?')[0];
  const route = `${method} ${path}`;

  if (route === 'GET /health') return ok({ status: 'ok' });

  if (route === 'POST /auth/login') {
    const { email = '', password = '' } = (body ?? {}) as { email?: string; password?: string };
    const details: Record<string, string[]> = {};
    if (!email) details.email = ['The email field is required.'];
    if (!password) details.password = ['The password field is required.'];
    if (Object.keys(details).length) return fail(422, 'VALIDATION_ERROR', 'The given data was invalid.', details);

    const user = Object.values(users).find((u) => u.employee.email === email.toLowerCase());
    if (!user || password !== MOCK_PASSWORD) return fail(401, 'UNAUTHENTICATED', 'Invalid email or password.');
    return ok({ token: `mock-token-${user.role}`, expires_at: '2026-12-31 23:59:59', user });
  }

  const user = currentUser(token);
  if (!user) return fail(401, 'UNAUTHENTICATED', 'Your session has expired. Please log in again.');

  if (route === 'POST /auth/logout') return noContent();
  if (route === 'GET /auth/me') return ok(user);

  return fail(404, 'NOT_FOUND', `Mock API has no handler for ${route}.`);
}
