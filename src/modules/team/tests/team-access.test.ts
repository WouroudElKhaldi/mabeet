import { describe, expect, it } from "vitest";
import type { Permission } from "@/config/permissions";
import { assignableRoles, canManageMember, holdsEveryPermission } from "../team-access";

function viewer(permissions: Permission[], isOwner = false) {
  return { membershipId: "m-me", isOwner, permissions: new Set(permissions) };
}

const owner = { id: "r-owner", isOwner: true, permissions: [] };
const frontDesk = { id: "r-desk", isOwner: false, permissions: ["bookings.read", "bookings.decide"] };
const finance = { id: "r-finance", isOwner: false, permissions: ["analytics.read"] };

describe("what the Team page offers", () => {
  it("offers only the roles within the person's own permissions, and the owner role only to an owner", () => {
    const manager = viewer(["team.manage", "bookings.read", "bookings.decide"]);
    expect(assignableRoles(manager, [owner, frontDesk, finance])).toEqual([frontDesk]);
    const anOwner = viewer(["team.manage", "bookings.read", "bookings.decide", "analytics.read"], true);
    // The owner role last, so it is never the form's first choice.
    expect(assignableRoles(anOwner, [owner, frontDesk, finance])).toEqual([frontDesk, finance, owner]);
  });

  it("lets a role be edited only by someone holding all of its permissions", () => {
    expect(holdsEveryPermission(viewer(["roles.manage", "bookings.read"]), frontDesk)).toBe(false);
    expect(holdsEveryPermission(viewer(["roles.manage", "analytics.read"]), finance)).toBe(true);
  });

  it("never offers changing one's own access, and leaves owners to owners", () => {
    const manager = viewer(["team.manage"]);
    expect(canManageMember(manager, { id: "m-me", isOwner: false })).toBe(false);
    expect(canManageMember(manager, { id: "m-other", isOwner: false })).toBe(true);
    expect(canManageMember(manager, { id: "m-boss", isOwner: true })).toBe(false);
    expect(canManageMember(viewer([], true), { id: "m-boss", isOwner: true })).toBe(true);
  });
});
