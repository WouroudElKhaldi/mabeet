import { beforeEach, describe, expect, it } from "vitest";
import { resolveContext } from "@/server/auth/resolve-context";
import { createPlace, createUser, memberWith, prisma } from "@tests/integration/helpers";
import { acceptInvitation, inviteMember } from "../server/invitation-service";
import {
  changeMemberRole,
  createRole,
  deleteRole,
  listRoles,
  removeMember,
  updateRole,
} from "../server/team-service";

describe("dynamic roles and permissions", () => {
  let place: Awaited<ReturnType<typeof createPlace>>;

  beforeEach(async () => {
    place = await createPlace();
  });

  it("lets an owner create a custom role with any permissions", async () => {
    const role = await createRole(place.ctx, {
      name: "Night shift",
      permissions: ["bookings.read", "bookings.decide"],
    });
    expect(role.permissions).toEqual(["bookings.read", "bookings.decide"]);
  });

  it("stops a manager from granting a permission they do not hold", async () => {
    const manager = await memberWith(place.business.id, ["roles.manage", "bookings.read"]);
    await expect(
      createRole(manager, { name: "Sneaky", permissions: ["bookings.read", "settings.manage"] }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      createRole(manager, { name: "Viewer", permissions: ["bookings.read"] }),
    ).resolves.toBeDefined();
  });

  it("stops a manager from editing a role that holds more than they do", async () => {
    const manager = await memberWith(place.business.id, ["roles.manage", "bookings.read"]);
    const powerful = await createRole(place.ctx, { name: "Finance", permissions: ["analytics.read"] });
    await expect(updateRole(manager, powerful.id, { name: "Renamed" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("protects the owner role from changes and deletion", async () => {
    const ownerRole = await prisma.role.findFirstOrThrow({
      where: { businessId: place.business.id, isOwner: true },
    });
    await expect(updateRole(place.ctx, ownerRole.id, { name: "Boss" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(deleteRole(place.ctx, ownerRole.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("refuses to delete a role that still has members", async () => {
    const staff = await memberWith(place.business.id, ["bookings.read"]);
    const membership = await prisma.membership.findUniqueOrThrow({ where: { id: staff.membershipId } });
    await expect(deleteRole(place.ctx, membership.roleId)).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("only lets an owner make someone an owner", async () => {
    // A third person on the team: past the Free plan's two.
    await prisma.business.update({ where: { id: place.business.id }, data: { plan: "PRO" } });
    const manager = await memberWith(place.business.id, ["team.manage", "roles.manage"]);
    const ownerRole = await prisma.role.findFirstOrThrow({
      where: { businessId: place.business.id, isOwner: true },
    });
    const newcomer = await createUser("Newcomer");
    const invite = { name: "Newcomer", email: newcomer.email, phone: "+96171000001", roleId: ownerRole.id };
    await expect(inviteMember(manager, invite, "en")).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(inviteMember(place.ctx, invite, "en")).resolves.toBeDefined();
  });

  it("stops anyone changing their own access", async () => {
    await expect(removeMember(place.ctx, place.ctx.membershipId)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("stops a manager from removing or demoting an owner", async () => {
    const manager = await memberWith(place.business.id, ["team.manage", "bookings.read"]);
    const viewerRole = await createRole(place.ctx, { name: "Viewer", permissions: ["bookings.read"] });
    await expect(removeMember(manager, place.ctx.membershipId)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(changeMemberRole(manager, place.ctx.membershipId, viewerRole.id)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("stops 'add member' from changing an existing member's role, owners included", async () => {
    const manager = await memberWith(place.business.id, ["team.manage", "bookings.read"]);
    const viewerRole = await createRole(place.ctx, { name: "Viewer", permissions: ["bookings.read"] });
    const owner = await prisma.user.findUniqueOrThrow({ where: { id: place.ctx.userId } });
    await expect(
      inviteMember(
        manager,
        { name: "Owner", email: owner.email, phone: "+96171000001", roleId: viewerRole.id },
        "en",
      ),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    const ownerMembership = await prisma.membership.findUniqueOrThrow({
      where: { id: place.ctx.membershipId },
      include: { role: true },
    });
    expect(ownerMembership.role.isOwner).toBe(true);
  });

  it("lets a removed member be invited back", async () => {
    const staff = await memberWith(place.business.id, ["bookings.read"]);
    const viewerRole = await createRole(place.ctx, { name: "Viewer", permissions: ["bookings.read"] });
    await removeMember(place.ctx, staff.membershipId);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: staff.userId } });
    const { id } = await inviteMember(
      place.ctx,
      { name: user.name, email: user.email, phone: "+96171000001", roleId: viewerRole.id },
      "en",
    );
    const { token } = await prisma.invitation.findUniqueOrThrow({ where: { id } });
    await acceptInvitation(user, token);
    expect(await prisma.membership.findUniqueOrThrow({ where: { id: staff.membershipId } })).toMatchObject({
      status: "ACTIVE",
      roleId: viewerRole.id,
    });
  });

  it("deletes a role whose only members were removed, keeping the row marked deleted", async () => {
    const staff = await memberWith(place.business.id, ["bookings.read"]);
    const membership = await prisma.membership.findUniqueOrThrow({ where: { id: staff.membershipId } });
    await removeMember(place.ctx, staff.membershipId);
    await expect(deleteRole(place.ctx, membership.roleId)).resolves.toBeUndefined();
    expect(await prisma.role.findUnique({ where: { id: membership.roleId } })).toMatchObject({
      isDeleted: true,
    });
    expect((await listRoles(place.ctx)).map((role) => role.id)).not.toContain(membership.roleId);
    await expect(deleteRole(place.ctx, membership.roleId)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("brings a deleted role's name back when a new role uses it", async () => {
    const role = await createRole(place.ctx, { name: "Cleaner", description: null, permissions: [] });
    await deleteRole(place.ctx, role.id);
    const again = await createRole(place.ctx, { name: "Cleaner", description: null, permissions: [] });
    expect(again).toMatchObject({ name: "Cleaner", isDeleted: false });
  });

  it("takes access away as soon as a member is removed", async () => {
    const staff = await memberWith(place.business.id, ["bookings.read"]);
    await removeMember(place.ctx, staff.membershipId);
    expect(await resolveContext(staff.userId, place.business.id)).toBeNull();
  });
});
