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
