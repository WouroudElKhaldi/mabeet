import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { ALL_PERMISSIONS, DEFAULT_ROLE_TEMPLATES } from "@/config/permissions";
import { listWorkspaces } from "@/modules/team/server";
import { resolveContext } from "@/server/auth/resolve-context";
import { createUser, prisma } from "@tests/integration/helpers";
import { createWorkspace } from "../server/onboarding-service";

describe("creating a place", () => {
  it("makes the creator its owner, with every permission, and adds the starter roles", async () => {
    const owner = await createUser("Nour Haddad");
    const business = await createWorkspace(owner.id, { name: "Dar Al Sindiyan", area: "Deir el Qamar" });

    const ctx = await resolveContext(owner.id, business.id);
    expect(ctx).toMatchObject({ isOwner: true, businessId: business.id });
    expect([...(ctx?.permissions ?? [])].sort()).toEqual([...ALL_PERMISSIONS].sort());
    const roles = await prisma.role.findMany({ where: { businessId: business.id } });
    expect(roles.filter((role) => role.isOwner)).toHaveLength(1);
    expect(
      roles
        .filter((role) => !role.isOwner)
        .map((role) => role.name)
        .sort(),
    ).toEqual(DEFAULT_ROLE_TEMPLATES.map((role) => role.name).sort());
    expect(await listWorkspaces(owner.id)).toMatchObject([
      { business: { id: business.id }, role: { name: "Owner" } },
    ]);
  });

  it("gives two places with the same name different booking links", async () => {
    const owner = await createUser();
    const name = `Beit Batroun ${randomUUID()}`;
    const first = await createWorkspace(owner.id, { name });
    const second = await createWorkspace(owner.id, { name });
    expect(second.slug).not.toBe(first.slug);
    expect(second.slug.startsWith(first.slug)).toBe(true);
  });

  it("saves nothing at all when a step fails: no place, no roles", async () => {
    const name = `Ehden Stone House ${randomUUID()}`;
    // An owner who does not exist makes the last step (the owner's membership) fail.
    await expect(createWorkspace(randomUUID(), { name })).rejects.toThrow();
    expect(await prisma.business.count({ where: { name } })).toBe(0);
    expect(await prisma.role.count({ where: { business: { name } } })).toBe(0);
  });
});
