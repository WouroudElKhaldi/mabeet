// How the browser calls our own API. Every call goes through here, never through `fetch` directly, so every failure
// reaches the screen in one shape. The server answers a failure as { error: { code, message, details } } (see
// `route` in src/server/http/route.ts).

export type Query = Record<string, string | number | boolean | null | undefined>;

// What the server may say about a failure that a guest or a host should not read as it is.
const UNHELPFUL_CODES = ["INTERNAL", "NETWORK", "TIMEOUT", "ABORTED", "UNKNOWN"];

// How long a call may take before we give up. Without a limit, a connection that goes quiet (a phone moving between
// towers, a server that hangs) leaves a spinner turning for ever.
const DEFAULT_TIMEOUT_MS = 30_000;
const UPLOAD_TIMEOUT_MS = 120_000;

export interface RequestOptions {
  /**
   * Cancels the call when it is aborted: a search typed over, a page left. The call then fails with code `ABORTED`
   * (see `isAborted`), which is not a problem to show to anyone.
   */
  signal?: AbortSignal;
  /** How long to wait for the whole answer. 30 seconds, or 2 minutes for an upload. */
  timeoutMs?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * A call that failed. The server refused it, or it never got an answer, with `status` 0 and a code of ours:
 * `NETWORK` (no connection), `TIMEOUT` (it took too long) or `ABORTED` (we cancelled it).
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
    /** Set on 429: how long to wait before trying again. */
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** The first problem of each wrong field after a failed input check: `{ phone: "Use an international number" }`. */
  get fieldErrors(): Record<string, string> {
    const fields =
      isRecord(this.details) && isRecord(this.details.fieldErrors) ? this.details.fieldErrors : {};
    const firstProblems: Record<string, string> = {};
    for (const [field, problems] of Object.entries(fields)) {
      if (Array.isArray(problems) && typeof problems[0] === "string") firstProblems[field] = problems[0];
    }
    return firstProblems;
  }
}

/**
 * The text to show for a failure. The server's own words, when it said something a person can act on ("Those dates
 * were just taken"). Otherwise `fallback`, which the screen passes already translated: a crash on our side, a lost
 * connection, or an answer we could not read.
 */
export function errorMessage(caught: unknown, fallback: string): string {
  if (caught instanceof ApiError && !UNHELPFUL_CODES.includes(caught.code) && caught.message)
    return caught.message;
  return fallback;
}

/**
 * What a form shows after a failed call: when the server named the wrong fields, a message under each one
 * (`fieldErrors`, by field name) and no message for the whole form; otherwise one message for the whole form.
 */
export function formFailure(caught: unknown, fallback: string) {
  const fieldErrors = caught instanceof ApiError ? caught.fieldErrors : {};
  const namesFields = Object.keys(fieldErrors).length > 0;
  return { error: namesFields ? null : errorMessage(caught, fallback), fieldErrors };
}

/** True when we cancelled the call ourselves. Nothing went wrong, so nothing should be shown. */
export function isAborted(caught: unknown): boolean {
  return caught instanceof ApiError && caught.code === "ABORTED";
}

function readJson(text: string): unknown {
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function failure(response: Response, data: unknown): ApiError {
  const error = isRecord(data) && isRecord(data.error) ? data.error : {};
  const retryAfter = Number(response.headers.get("retry-after"));
  return new ApiError(
    response.status,
    typeof error.code === "string" ? error.code : "UNKNOWN",
    typeof error.message === "string" ? error.message : response.statusText || "Request failed",
    error.details,
    Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined,
  );
}

async function send<T>(
  method: string,
  url: string,
  body?: BodyInit,
  headers?: Record<string, string>,
  options: RequestOptions = {},
): Promise<T> {
  const { signal, timeoutMs = DEFAULT_TIMEOUT_MS } = options;
  // Cancelled before it started: there is nothing to send.
  if (signal?.aborted) throw new ApiError(0, "ABORTED", "The request was cancelled");

  // One controller carries both reasons to stop (the caller's signal and the time limit). `AbortSignal.any` would do
  // it in one line, but iPhones older than iOS 17.4 do not have it.
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const stopWhenCancelled = () => controller.abort();
  signal?.addEventListener("abort", stopWhenCancelled, { once: true });

  let response: Response;
  let text: string;
  try {
    response = await fetch(url, {
      method,
      body,
      headers: { accept: "application/json", ...headers },
      signal: controller.signal,
    });
    text = await response.text();
  } catch {
    if (signal?.aborted) throw new ApiError(0, "ABORTED", "The request was cancelled");
    if (timedOut) throw new ApiError(0, "TIMEOUT", "The server took too long to answer");
    throw new ApiError(0, "NETWORK", "The server could not be reached");
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", stopWhenCancelled);
  }
  const data = readJson(text);
  if (!response.ok) throw failure(response, data);
  return data as T;
}

function sendJson<T>(method: string, url: string, body?: unknown, options?: RequestOptions): Promise<T> {
  if (body === undefined) return send<T>(method, url, undefined, undefined, options);
  return send<T>(method, url, JSON.stringify(body), { "content-type": "application/json" }, options);
}

/** The address with its query: `queryUrl("/api/x", { page: 2, q: undefined })` is `/api/x?page=2`. */
export function queryUrl(url: string, query?: Query): string {
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null) params.set(name, String(value));
  }
  const text = params.toString();
  return text ? `${url}${url.includes("?") ? "&" : "?"}${text}` : url;
}

export const api = {
  get: <T>(url: string, query?: Query, options?: RequestOptions) =>
    sendJson<T>("GET", queryUrl(url, query), undefined, options),
  post: <T>(url: string, body?: unknown, options?: RequestOptions) => sendJson<T>("POST", url, body, options),
  patch: <T>(url: string, body?: unknown, options?: RequestOptions) =>
    sendJson<T>("PATCH", url, body, options),
  put: <T>(url: string, body?: unknown, options?: RequestOptions) => sendJson<T>("PUT", url, body, options),
  delete: <T = void>(url: string, options?: RequestOptions) => sendJson<T>("DELETE", url, undefined, options),
  /** Photos and other files. The browser sets the content type itself, with the boundary the server needs. */
  upload: <T>(url: string, form: FormData, options?: RequestOptions) =>
    send<T>("POST", url, form, undefined, { ...options, timeoutMs: options?.timeoutMs ?? UPLOAD_TIMEOUT_MS }),
};
