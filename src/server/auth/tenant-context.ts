import type { Permission } from "@/config/permissions";
import { forbidden } from "@/server/errors";

export type Channel = "web" | "mcp" | "chat";

/** Who is acting, in which business, with which permissions. Built once per request and passed down. */
export interface TenantContext {
  readonly userId: string;
  readonly businessId: string;
  readonly membershipId: string;
  readonly isOwner: boolean;
  readonly permissions: ReadonlySet<Permission>;
  readonly channel: Channel;
  /**
   * A platform admin acting in a business they don't belong to: every permission, on the website only.
   * Their actions are logged under their own user id. They have no membership, so `membershipId` is empty.
   */
  readonly platformAdmin?: boolean;
  /** A read-only AI key or token: it stays read-only in every place it reaches. */
  readonly readOnly?: boolean;
}

/**
 * A platform admin in the admin area (`/admin`, `/api/admin/**`), where no business is chosen. Only
 * `resolvePlatformActor` makes one, after reading the person's role from the database.
 */
export interface PlatformActor {
  readonly userId: string;
  readonly platformAdmin: true;
}

/** For what only a platform admin may do. The type already says so; this refuses anything that got around it. */
export function requirePlatformAdmin(actor: PlatformActor): void {
  if (actor.platformAdmin !== true) throw forbidden("Platform admins only");
}

export function can(ctx: TenantContext, permission: Permission): boolean {
  return ctx.permissions.has(permission);
}

export function requirePermission(ctx: TenantContext, permission: Permission): void {
  if (!can(ctx, permission)) throw forbidden(`Missing permission: ${permission}`);
}

/** For what only an owner may do (spend the business's money, see payouts), whatever a role's permissions say. */
export function requireOwner(ctx: TenantContext, refusal: string): void {
  if (!ctx.isOwner) throw forbidden(refusal);
}
