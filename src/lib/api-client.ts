// How the browser calls our own API. Every call goes through here, never through `fetch` directly, so every failure
// reaches the screen in one shape. The server answers a failure as { error: { code, message, details } } (see
// `route` in src/server/http/route.ts).

type Query = Record<string, string | number | boolean | null | undefined>;

// What the server may say about a failure that a guest or a host should not read as it is.
const UNHELPFUL_CODES = ["INTERNAL", "NETWORK", "UNKNOWN"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** A call that failed: the server refused it, or it never got there (`status` 0, code `NETWORK`). */
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
): Promise<T> {
  let response: Response;
  let text: string;
  try {
    response = await fetch(url, { method, body, headers: { accept: "application/json", ...headers } });
    text = await response.text();
  } catch {
    throw new ApiError(0, "NETWORK", "The server could not be reached");
  }
  const data = readJson(text);
  if (!response.ok) throw failure(response, data);
  return data as T;
}

function sendJson<T>(method: string, url: string, body?: unknown): Promise<T> {
  if (body === undefined) return send<T>(method, url);
  return send<T>(method, url, JSON.stringify(body), { "content-type": "application/json" });
}

function withQuery(url: string, query?: Query): string {
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null) params.set(name, String(value));
  }
  const text = params.toString();
  return text ? `${url}${url.includes("?") ? "&" : "?"}${text}` : url;
}

export const api = {
  get: <T>(url: string, query?: Query) => sendJson<T>("GET", withQuery(url, query)),
  post: <T>(url: string, body?: unknown) => sendJson<T>("POST", url, body),
  patch: <T>(url: string, body?: unknown) => sendJson<T>("PATCH", url, body),
  put: <T>(url: string, body?: unknown) => sendJson<T>("PUT", url, body),
  delete: <T = void>(url: string) => sendJson<T>("DELETE", url),
  /** Photos and other files. The browser sets the content type itself, with the boundary the server needs. */
  upload: <T>(url: string, form: FormData) => send<T>("POST", url, form),
};
