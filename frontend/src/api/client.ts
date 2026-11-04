import type { ApiErrorBody } from './types';

const BASE_URL = '/api/v1';
const TOKEN_KEY = 'hr.token';
const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true';

/** Error thrown for every non-2xx response, carrying the contract's error body. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: Record<string, string[]>;

  constructor(status: number, body: ApiErrorBody['error']) {
    super(body.message);
    this.status = status;
    this.code = body.code;
    this.details = body.details ?? {};
  }
}

export const tokenStore = {
  get: (): string | null => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

let onUnauthorized: () => void = () => {};

/** Called when any request (except login) gets 401 — the session has expired. */
export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
type Query = Record<string, string | number | boolean | null | undefined>;

export interface RawResponse {
  status: number;
  body: unknown;
}

async function send(method: Method, path: string, body?: unknown, query?: Query): Promise<unknown> {
  const token = tokenStore.get();
  const url = path + buildQuery(query);

  let res: RawResponse;
  if (USE_MOCKS) {
    const { mockRequest } = await import('./mock'); // dropped from production builds
    res = await mockRequest(method, url, body, token);
  } else {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(BASE_URL + url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    res = { status: response.status, body: text ? safeJson(text) : null };
  }

  if (res.status >= 200 && res.status < 300) return res.body;

  if (res.status === 401 && path !== '/auth/login') {
    tokenStore.clear();
    onUnauthorized();
  }
  throw new ApiError(res.status, toErrorBody(res.body));
}

function buildQuery(query?: Query): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function toErrorBody(body: unknown): ApiErrorBody['error'] {
  const error = (body as ApiErrorBody | null)?.error;
  if (error?.code && error.message) return error;
  return { code: 'SERVER_ERROR', message: 'Something went wrong. Please try again.' };
}

/** Unwraps `{ data }` for single-item endpoints. */
async function item<T>(method: Method, path: string, body?: unknown, query?: Query): Promise<T> {
  const res = (await send(method, path, body, query)) as { data: T } | null;
  return res?.data as T;
}

export const api = {
  get: <T>(path: string, query?: Query) => item<T>('GET', path, undefined, query),
  post: <T>(path: string, body?: unknown) => item<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => item<T>('PUT', path, body),
  patch: <T>(path: string, body?: unknown) => item<T>('PATCH', path, body),
  delete: (path: string) => send('DELETE', path).then(() => undefined),
  /** For paginated lists: returns `{ data, meta }` as-is. */
  list: <T>(path: string, query?: Query) => send('GET', path, undefined, query) as Promise<T>,
};
