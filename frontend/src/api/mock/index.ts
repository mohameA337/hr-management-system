// Development-only fake backend, enabled with VITE_USE_MOCKS=true.
// Implements the 9 endpoints of docs/API.md (shapes, status codes, roles and business rules) on top
// of an in-memory database, so every screen works before the PHP endpoints exist. It is also a
// readable reference for the rules the real backend must enforce.

import type { RawResponse } from '../client';
import { getDb, resetDb, saveDb } from './db';
import { authRoutes } from './handlers/auth';
import { employeeRoutes } from './handlers/employees';
import { holidayRoutes } from './handlers/holidays';
import { leaveRoutes } from './handlers/leave';
import { HttpError, forbidden, type Ctx, type Route } from './http';

const routes: Route[] = [...authRoutes, ...employeeRoutes, ...leaveRoutes, ...holidayRoutes];

function match(pattern: string, path: string): Record<string, string> | null {
  const expected = pattern.split('/');
  const actual = path.split('/');
  if (expected.length !== actual.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < expected.length; i++) {
    if (expected[i].startsWith(':')) params[expected[i].slice(1)] = decodeURIComponent(actual[i]);
    else if (expected[i] !== actual[i]) return null;
  }
  return params;
}

function errorResponse(error: HttpError): RawResponse {
  return {
    status: error.status,
    body: { error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) } },
  };
}

export { resetDb as resetMockData };

export async function mockRequest(method: string, url: string, body: unknown, token: string | null): Promise<RawResponse> {
  await new Promise((resolve) => setTimeout(resolve, 200 + Math.random() * 200)); // feel like a network call

  const [path, queryString = ''] = url.split('?');
  let route: Route | undefined;
  let params: Record<string, string> | null = null;
  for (const candidate of routes) {
    const found = candidate.method === method ? match(candidate.path, path) : null;
    if (found) {
      route = candidate;
      params = found;
      break;
    }
  }
  if (!route || !params) return errorResponse(new HttpError(404, 'NOT_FOUND', `No endpoint for ${method} ${path}.`));

  const db = getDb();
  try {
    const ctx = { params, query: new URLSearchParams(queryString), body: (body ?? {}) as Record<string, unknown>, db } as Ctx;

    if (!route.public) {
      const session = db.auth_tokens.find((t) => t.token === token);
      const me = session && db.employees.find((e) => e.id === session.employee_id && e.status === 'active');
      if (!session || !me) throw new HttpError(401, 'UNAUTHENTICATED', 'Your session has expired. Please log in again.');
      ctx.me = me;
      ctx.token = session.token;
      if (route.hrOnly && me.role !== 'hr') throw forbidden();
    }

    const response = route.handler(ctx);
    if (method !== 'GET') saveDb();
    // Return a copy so screens can never modify the fake database by accident.
    return { status: response.status, body: response.body === null ? null : JSON.parse(JSON.stringify(response.body)) };
  } catch (error) {
    if (error instanceof HttpError) return errorResponse(error);
    console.error('[mock api]', error);
    return errorResponse(new HttpError(500, 'SERVER_ERROR', 'Something went wrong. Please try again.'));
  }
}
