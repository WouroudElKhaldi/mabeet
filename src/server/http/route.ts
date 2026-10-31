import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { auth } from "@/server/auth/better-auth";
import { resolveContext } from "@/server/auth/resolve-context";
import type { TenantContext } from "@/server/auth/tenant-context";
import { env } from "@/server/env";
import { AppError, forbidden, invalid, notFound, unauthenticated } from "@/server/errors";

type RouteContext = { params: Promise<Record<string, string>> };
type Handler = (request: Request, context: RouteContext) => Promise<Response>;

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Defence in depth against cross-site requests, on top of SameSite cookies: a browser always sends Origin
 * on a write, and a write from another site is refused. Callers with no Origin (servers, webhooks) or that
 * authenticate with a bearer token (MCP clients) carry no ambient cookie to abuse, so they pass.
 */
function assertSameOrigin(request: Request): void {
  if (SAFE_METHODS.has(request.method) || request.headers.has("authorization")) return;
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(env.BETTER_AUTH_URL).origin) {
    throw forbidden("Cross-site request refused");
  }
}

/** Wraps a route handler: maps domain errors to HTTP and never leaks internals on unexpected ones. */
export function route(handler: Handler): Handler {
  return async (request, context) => {
    try {
      assertSameOrigin(request);
      return await handler(request, context);
    } catch (error) {
      return errorResponse(error);
    }
  };
}

/** A rate-limited caller is told, in the standard header, when to try again. */
function retryAfterHeader(error: AppError): Record<string, string> | undefined {
  const { details } = error;
  if (error.code !== "RATE_LIMITED" || typeof details !== "object" || details === null) return undefined;
  if (!("retryAfterSeconds" in details)) return undefined;
  return { "retry-after": String(details.retryAfterSeconds) };
}

/** Maps an error to JSON. Unexpected errors are logged and never leak details. */
function errorResponse(error: unknown): Response {
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: { code: "VALIDATION", message: "Invalid input", details: z.flattenError(error) } },
      { status: 400 },
    );
  }
  if (error instanceof AppError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message, details: error.details } },
      { status: error.status, headers: retryAfterHeader(error) },
    );
  }
  console.error(error);
  return NextResponse.json({ error: { code: "INTERNAL", message: "Something went wrong" } }, { status: 500 });
}

export function json(body: unknown, status = 200): Response {
  return NextResponse.json(body, { status });
}

export async function parseBody<T extends z.ZodType>(request: Request, schema: T): Promise<z.infer<T>> {
  const body: unknown = await request.json().catch(() => {
    throw invalid("Request body must be JSON");
  });
  return schema.parse(body);
}

export function parseQuery<T extends z.ZodType>(request: Request, schema: T): z.infer<T> {
  return schema.parse(Object.fromEntries(new URL(request.url).searchParams));
}

export async function parseParams<T extends z.ZodType>(
  context: RouteContext,
  schema: T,
): Promise<z.infer<T>> {
  return schema.parse(await context.params);
}

export async function optionalUser(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  return session?.user ?? null;
}

export async function requireUser(request: Request) {
  const user = await optionalUser(request);
  if (!user) throw unauthenticated();
  return user;
}

/** Scheduled jobs call in with `Authorization: Bearer <CRON_SECRET>`. */
export function requireCronSecret(request: Request): void {
  const presented = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${env.CRON_SECRET}`);
  if (presented.length !== expected.length || !timingSafeEqual(presented, expected)) throw unauthenticated();
}

/** Resolves the caller's membership in the workspace named by the URL. Non-members get 404, never 403. */
async function requireTenant(request: Request, businessId: string): Promise<TenantContext> {
  const user = await requireUser(request);
  const ctx = await resolveContext(user.id, businessId);
  if (!ctx) throw notFound("Workspace");
  return ctx;
}

interface TenantHandlerArgs<Params> {
  request: Request;
  ctx: TenantContext;
  params: Params;
}

/**
 * A workspace route: parses the URL params, then resolves the caller's membership in that business before the
 * handler runs, so no workspace route can forget the tenant check. Non-members get 404.
 */
export function tenantRoute<Schema extends z.ZodType<{ businessId: string }>>(
  schema: Schema,
  handler: (args: TenantHandlerArgs<z.infer<Schema>>) => Promise<Response>,
): Handler {
  return route(async (request, context) => {
    const params = await parseParams(context, schema);
    const ctx = await requireTenant(request, params.businessId);
    return handler({ request, ctx, params });
  });
}
