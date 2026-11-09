import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import type { Permission } from "@/config/permissions";
import { auth } from "@/server/auth/better-auth";
import { resolveContext, resolvePlatformActor } from "@/server/auth/resolve-context";
import { can, type PlatformActor, type TenantContext } from "@/server/auth/tenant-context";
import { signInUrl } from "@/utils/sign-in-url";

// Sign-in for pages (server components). API routes use route() and tenantRoute() instead; both answer a
// non-member the same way, with "not found", so neither reveals that a business exists.

/** The sign-in session for server components, resolved once per request. */
export const getCurrentSession = cache(async () => auth.api.getSession({ headers: await headers() }));

/** The signed-in user for server components, resolved once per request. */
export const getCurrentUser = cache(async () => (await getCurrentSession())?.user ?? null);

/**
 * Signed-out visitors go to the one sign-in page; after signing in, /home sends them where their role belongs, or
 * back to `next` (a guest's booking pages pass their own address).
 */
export async function requirePageUser(next?: string) {
  const user = await getCurrentUser();
  if (!user) redirect(next ? signInUrl(next) : "/sign-in");
  return user;
}

/** The acting member for a dashboard page. Non-members get the 404 page, like the API. */
export const requirePageTenant = cache(async (businessId: string): Promise<TenantContext> => {
  const user = await requirePageUser();
  const ctx = await resolveContext(user.id, businessId);
  if (!ctx) notFound();
  return ctx;
});

/**
 * A dashboard page that needs one of `anyOf`. A member without it gets the 404 page, exactly like a non-member,
 * instead of a crash into the error page when a service refuses.
 */
export async function requirePageAccess(businessId: string, anyOf: readonly Permission[]) {
  const ctx = await requirePageTenant(businessId);
  if (!anyOf.some((permission) => can(ctx, permission))) notFound();
  return ctx;
}

/** The platform admin for an admin page. Anyone else gets the 404 page, so the admin area never shows it exists. */
export const requirePageAdmin = cache(async (): Promise<PlatformActor> => {
  const user = await requirePageUser("/admin");
  const actor = await resolvePlatformActor(user.id);
  if (!actor) notFound();
  return actor;
});
