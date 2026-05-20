import type { AxiosResponse } from 'axios';

import { http } from './http';

/**
 * Lightweight wrappers around the shared `http` axios instance that auto-unwrap
 * the standard `{ data, meta }` response envelope produced by the NestJS
 * `ResponseFormatInterceptor`.
 *
 * Use these in TanStack Query `queryFn` / `mutationFn` so call-sites work with
 * plain payloads (`User`, `Role[]`, …) instead of the envelope.
 */
export interface ApiEnvelope<T> {
  data: T;
  meta?: {
    requestId?: string | null;
    timestamp?: string;
    version?: string;
    pagination?: PaginationMeta;
    error?: ApiError;
    [k: string]: unknown;
  };
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiError {
  statusCode?: number;
  code?: string;
  message?: string;
  fields?: Record<string, string[]>;
  [k: string]: unknown;
}

/** Extract the `data` payload from an axios response. */
export function unwrap<T>(res: AxiosResponse<ApiEnvelope<T>>): T {
  return res.data.data;
}

/**
 * The NestJS API uses a global `/api/v1` prefix (see `apps/api/src/main.ts`).
 * Many domain API clients were written with bare paths like `/customers` while
 * the auth/admin clients used `/api/v1/...` explicitly. This helper ensures the
 * prefix is present exactly once regardless of how the caller spelled it.
 *
 * - `'/customers'`            → `'/api/v1/customers'`
 * - `'/api/v1/customers'`     → `'/api/v1/customers'` (unchanged)
 * - `'customers'`             → `'/api/v1/customers'`
 * - `'http://x/customers'`    → `'http://x/customers'` (absolute URLs untouched)
 */
const API_PREFIX = '/api/v1';
export function withApiPrefix(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  const normalized = url.startsWith('/') ? url : `/${url}`;
  if (normalized === API_PREFIX || normalized.startsWith(`${API_PREFIX}/`)) {
    return normalized;
  }
  return `${API_PREFIX}${normalized}`;
}

/** GET + unwrap. */
export async function apiGet<T>(url: string, config?: Parameters<typeof http.get>[1]): Promise<T> {
  return unwrap<T>(await http.get<ApiEnvelope<T>>(withApiPrefix(url), config));
}

/** POST + unwrap. */
export async function apiPost<T, B = unknown>(
  url: string,
  body?: B,
  config?: Parameters<typeof http.post>[2],
): Promise<T> {
  return unwrap<T>(await http.post<ApiEnvelope<T>>(withApiPrefix(url), body, config));
}

/** PATCH + unwrap. */
export async function apiPatch<T, B = unknown>(
  url: string,
  body?: B,
  config?: Parameters<typeof http.patch>[2],
): Promise<T> {
  return unwrap<T>(await http.patch<ApiEnvelope<T>>(withApiPrefix(url), body, config));
}

/** PUT + unwrap. */
export async function apiPut<T, B = unknown>(
  url: string,
  body?: B,
  config?: Parameters<typeof http.put>[2],
): Promise<T> {
  return unwrap<T>(await http.put<ApiEnvelope<T>>(withApiPrefix(url), body, config));
}

/** DELETE + unwrap. */
export async function apiDelete<T>(
  url: string,
  config?: Parameters<typeof http.delete>[1],
): Promise<T> {
  return unwrap<T>(await http.delete<ApiEnvelope<T>>(withApiPrefix(url), config));
}

/**
 * Best-effort error-message extractor for the Arabic toast / form layer.
 * Mirrors the envelope produced by `AllExceptionsFilter`.
 */
// biome-ignore lint/suspicious/noExplicitAny: we read off arbitrary axios errors
export function extractApiError(err: any): ApiError {
  const data = err?.response?.data;
  // Standard NestJS error envelope: { data: null, meta: { error: { ... } } }
  if (data?.meta?.error) return data.meta.error as ApiError;
  // Lower-level shape used by some legacy endpoints: { statusCode, message, ... }
  if (data?.statusCode || data?.message) return data as ApiError;
  return { message: err?.message ?? 'حدث خطأ غير متوقع' };
}
