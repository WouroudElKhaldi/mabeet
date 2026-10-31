export type ErrorCode =
  "VALIDATION" | "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "RATE_LIMITED" | "UNAVAILABLE";

const HTTP_STATUS: Record<ErrorCode, number> = {
  VALIDATION: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  UNAVAILABLE: 503,
};

export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }

  get status(): number {
    return HTTP_STATUS[this.code];
  }
}

export const notFound = (entity: string) => new AppError("NOT_FOUND", `${entity} not found`);
export const forbidden = (message = "You do not have permission to do this") =>
  new AppError("FORBIDDEN", message);
export const conflict = (message: string) => new AppError("CONFLICT", message);
export const unauthenticated = () => new AppError("UNAUTHENTICATED", "Sign in required");
export const unavailable = (message: string) => new AppError("UNAVAILABLE", message);
export const invalid = (message: string, details?: unknown) => new AppError("VALIDATION", message, details);
