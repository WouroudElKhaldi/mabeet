import { describe, expect, it } from "vitest";
import {
  ALL_PERMISSIONS,
  DEFAULT_ROLE_TEMPLATES,
  findUngrantable,
  readOnly,
  toPermissions,
} from "@/config/permissions";
import { can, requireOwner, requirePermission, type TenantContext } from "@/server/auth/tenant-context";
import { AppError } from "@/server/errors";

const context = (permissions: string[], isOwner = false): TenantContext => ({
  userId: "u1",
  businessId: "b1",
  membershipId: "m1",
  isOwner,
  permissions: toPermissions(permissions),
  channel: "web",
});

describe("permissions", () => {
  it("ignores unknown permission keys stored on a role", () => {
    expect([...toPermissions(["bookings.read", "launch.missiles"])]).toEqual(["bookings.read"]);
  });

  it("refuses to let anyone grant a permission they lack", () => {
    const grantor = toPermissions(["bookings.read", "roles.manage"]);
    expect(findUngrantable(grantor, ["bookings.read"])).toEqual([]);
    expect(findUngrantable(grantor, ["bookings.read", "settings.manage"])).toEqual(["settings.manage"]);
  });

  it("strips every write permission for read-only keys", () => {
    const narrowed = readOnly(
      toPermissions(["bookings.read", "bookings.decide", "analytics.read", "rooms.manage"]),
    );
    expect([...narrowed].sort()).toEqual(["analytics.read", "bookings.read"]);
  });

  it("throws FORBIDDEN when a member lacks the permission", () => {
    const ctx = context(["bookings.read"]);
    expect(can(ctx, "bookings.read")).toBe(true);
    expect(() => requirePermission(ctx, "bookings.decide")).toThrow(AppError);
    expect(() => requirePermission(ctx, "bookings.decide")).toThrow(/bookings.decide/);
  });

  it("keeps money and payouts for the owner, whatever a role's permissions say", () => {
    const everything = [
      "rooms.manage",
      "bookings.decide",
      "settings.manage",
      "team.manage",
      "roles.manage",
      "analytics.read",
    ];
    expect(() => requireOwner(context(everything), "Only the owner can request a payout")).toThrow(
      "Only the owner can request a payout",
    );
    expect(() => requireOwner(context([], true), "Only the owner can request a payout")).not.toThrow();
  });

  it("builds the default roles only from real permissions", () => {
    for (const role of DEFAULT_ROLE_TEMPLATES) {
      expect(role.permissions.every((permission) => ALL_PERMISSIONS.includes(permission))).toBe(true);
    }
    expect(DEFAULT_ROLE_TEMPLATES.find((role) => role.name === "Manager")?.permissions).not.toContain(
      "settings.manage",
    );
  });
});
