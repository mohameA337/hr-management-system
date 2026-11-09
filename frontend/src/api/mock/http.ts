// Response helpers and validation for the fake backend, following docs/API.md section 1.

import type { RawResponse } from '../client';
import type { EmployeeRow, MockDb } from './db';

export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: Record<string, string[]>;

  constructor(status: number, code: string, message: string, details?: Record<string, string[]>) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export interface Ctx {
  params: Record<string, string>;
  query: URLSearchParams;
  body: Record<string, unknown>;
  db: MockDb;
  /** The logged-in employee (set on every route except public ones). */
  me: EmployeeRow;
  token: string;
}

export interface Route {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  /** true = role `hr` only; omitted = any logged-in user. */
  hrOnly?: boolean;
  public?: boolean;
  handler: (ctx: Ctx) => RawResponse;
}

export const ok = (data: unknown, status = 200): RawResponse => ({ status, body: { data } });
export const created = (data: unknown) => ok(data, 201);

export function paginate<T>(items: T[], query: URLSearchParams): RawResponse {
  const perPage = Math.min(100, Math.max(1, Number(query.get('per_page')) || 20));
  const totalPages = Math.max(1, Math.ceil(items.length / perPage));
  const page = Math.max(1, Number(query.get('page')) || 1);
  return {
    status: 200,
    body: {
      data: items.slice((page - 1) * perPage, page * perPage),
      meta: { page, per_page: perPage, total: items.length, total_pages: totalPages },
    },
  };
}

export const notFound = (what = 'Record') => new HttpError(404, 'NOT_FOUND', `${what} not found.`);
export const forbidden = (message = 'You do not have permission to perform this action.') =>
  new HttpError(403, 'FORBIDDEN', message);
export const conflict = (message: string) => new HttpError(409, 'CONFLICT', message);

// ---------- Input helpers ----------

export function text(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  return '';
}

export const nullableText = (value: unknown) => text(value) || null;
export const isDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);
export const has = (body: Record<string, unknown>, field: string) => Object.prototype.hasOwnProperty.call(body, field);

/** Collects field errors and throws one 422 with all of them. */
export class Validator {
  private errors: Record<string, string[]> = {};

  add(field: string, message: string) {
    (this.errors[field] ??= []).push(message);
  }

  required(body: Record<string, unknown>, field: string, label: string): string {
    const value = text(body[field]);
    if (!value) this.add(field, `The ${label} field is required.`);
    return value;
  }

  check(condition: boolean, field: string, message: string) {
    if (!condition) this.add(field, message);
  }

  throwIfFailed() {
    if (Object.keys(this.errors).length > 0) {
      throw new HttpError(422, 'VALIDATION_ERROR', 'The given data was invalid.', this.errors);
    }
  }
}
