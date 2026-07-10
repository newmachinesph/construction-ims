/**
 * Client-side fetch helper for the JSON API. Speaks the server envelope:
 *   success -> { ok: true, data }
 *   failure -> { ok: false, error, code?, fieldErrors? }
 *
 * The route handlers live under /api (owned by the backend). This module is the
 * single place that knows the URL shape, so a convention change is a one-file fix.
 */

export interface ApiOk<T> {
  ok: true;
  data: T;
}

export interface ApiErr {
  ok: false;
  error: string;
  fieldErrors?: Record<string, string[]>;
}

export type ApiResult<T> = ApiOk<T> | ApiErr;

type Method = "POST" | "PATCH" | "PUT" | "DELETE";

async function send<T>(url: string, method: Method, body?: unknown): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    let json: unknown = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }

    const payload = (json ?? {}) as Partial<ApiErr> & Partial<ApiOk<T>>;

    if (!res.ok || payload.ok === false) {
      return {
        ok: false,
        error: payload.error ?? `Request failed (${res.status}).`,
        fieldErrors: payload.fieldErrors,
      };
    }
    return { ok: true, data: payload.data as T };
  } catch {
    return { ok: false, error: "Network error. Check your connection and try again." };
  }
}

export const api = {
  post: <T = unknown>(url: string, body?: unknown) => send<T>(url, "POST", body),
  patch: <T = unknown>(url: string, body?: unknown) => send<T>(url, "PATCH", body),
  put: <T = unknown>(url: string, body?: unknown) => send<T>(url, "PUT", body),
  del: <T = unknown>(url: string, body?: unknown) => send<T>(url, "DELETE", body),
};
