import { beforeAll, describe, expect, it } from "vitest";
import * as authRoute from "@/app/api/auth/[...all]/route";
import * as invitationItem from "@/app/api/workspaces/[businessId]/invitations/[invitationId]/route";
import * as invitations from "@/app/api/workspaces/[businessId]/invitations/route";
import * as memberItem from "@/app/api/workspaces/[businessId]/members/[membershipId]/route";
import * as members from "@/app/api/workspaces/[businessId]/members/route";
import * as roleItem from "@/app/api/workspaces/[businessId]/roles/[roleId]/route";
import * as roles from "@/app/api/workspaces/[businessId]/roles/route";
import * as workspaces from "@/app/api/workspaces/route";
import { prisma, testEmail } from "./helpers";
import { call, type Caller, signUp, TEST_PASSWORD } from "./http";

interface Tenant {
  owner: Caller;
  businessId: string;
  roleId: string;
  membershipId: string;
  invitationId: string;
}

async function createTenant(name: string): Promise<Tenant> {
  const owner = await signUp(`${name} owner`);
  const created = await call(workspaces.POST, { as: owner, body: { name } });
  expect(created.status).toBe(201);
  const { id: businessId } = created.body as { id: string };
  const role = await prisma.role.findFirstOrThrow({ where: { businessId, isOwner: false } });
  const membership = await prisma.membership.findFirstOrThrow({ where: { businessId } });
  const invited = await call(invitations.POST, {
    as: owner,
    params: { businessId },
    body: { name: "Rana Khalil", email: testEmail(), phone: "+96171555111", roleId: role.id },
  });
  expect(invited.status).toBe(201);
  return {
    owner,
    businessId,
    roleId: role.id,
    membershipId: membership.id,
    invitationId: (invited.body as { id: string }).id,
  };
}

/** Business A's owner, fully signed in, aims every workspace route at business B, with B's real ids. */
describe("business isolation over HTTP", () => {
  let a: Tenant;
  let b: Tenant;

  beforeAll(async () => {
    a = await createTenant("Beit Alpha");
    b = await createTenant("Beit Bravo");
  });

  it("asks a signed-out visitor to sign in", async () => {
    expect((await call(members.GET, { params: { businessId: a.businessId } })).status).toBe(401);
    expect((await call(workspaces.GET)).status).toBe(401);
  });

  it("lets the owner into their own workspace", async () => {
    const own = await call(members.GET, { as: a.owner, params: { businessId: a.businessId } });
    expect(own.status).toBe(200);
    expect(own.body).toHaveLength(1);
    const mine = await call(workspaces.GET, { as: a.owner });
    expect((mine.body as { businessId: string }[]).map((row) => row.businessId)).toEqual([a.businessId]);
  });

  it("hides another workspace entirely, even when its ids are known, and changes nothing there", async () => {
    const asA = { as: a.owner };
    const inB = { businessId: b.businessId };
    const attempts = [
      call(members.GET, { ...asA, params: inB }),
      call(memberItem.PATCH, {
        ...asA,
        method: "PATCH",
        params: { ...inB, membershipId: b.membershipId },
        body: { roleId: b.roleId },
      }),
      call(memberItem.DELETE, { ...asA, method: "DELETE", params: { ...inB, membershipId: b.membershipId } }),
      call(roles.GET, { ...asA, params: inB }),
      call(roles.POST, { ...asA, params: inB, body: { name: "Intruder", permissions: [] } }),
      call(roleItem.PATCH, {
        ...asA,
        method: "PATCH",
        params: { ...inB, roleId: b.roleId },
        body: { name: "Hacked" },
      }),
      call(roleItem.DELETE, { ...asA, method: "DELETE", params: { ...inB, roleId: b.roleId } }),
      call(invitations.GET, { ...asA, params: inB }),
      call(invitations.POST, {
        ...asA,
        params: inB,
        body: { name: "Intruder", email: testEmail(), phone: "+96171555112", roleId: b.roleId },
      }),
      call(invitationItem.DELETE, {
        ...asA,
        method: "DELETE",
        params: { ...inB, invitationId: b.invitationId },
      }),
    ];
    for (const attempt of await Promise.all(attempts)) expect(attempt.status).toBe(404);

    expect(await prisma.role.count({ where: { businessId: b.businessId, name: "Intruder" } })).toBe(0);
    expect(await prisma.role.findUniqueOrThrow({ where: { id: b.roleId } })).toMatchObject({
      isDeleted: false,
    });
    expect(await prisma.membership.findUniqueOrThrow({ where: { id: b.membershipId } })).toMatchObject({
      status: "ACTIVE",
    });
    expect(await prisma.invitation.findUniqueOrThrow({ where: { id: b.invitationId } })).toMatchObject({
      status: "PENDING",
    });
  });

  it("refuses staff what their role does not allow, with 403", async () => {
    const staff = await signUp("Front desk");
    const frontDesk = await prisma.role.findFirstOrThrow({
      where: { businessId: a.businessId, name: "Front desk" },
    });
    await prisma.membership.create({
      data: { userId: staff.userId, businessId: a.businessId, roleId: frontDesk.id },
    });

    expect((await call(members.GET, { as: staff, params: { businessId: a.businessId } })).status).toBe(403);
    expect((await call(roles.GET, { as: staff, params: { businessId: a.businessId } })).status).toBe(403);
  });

  it("lets a platform admin into any workspace, without being a member", async () => {
    const admin = await signUp("Platform admin");
    await prisma.user.update({ where: { id: admin.userId }, data: { platformRole: "SUPER_ADMIN" } });

    const seen = await call(members.GET, { as: admin, params: { businessId: b.businessId } });

    expect(seen.status).toBe(200);
    expect(await prisma.membership.count({ where: { userId: admin.userId } })).toBe(0);
  });

  it("never lets anyone become a platform admin by signing up", async () => {
    const email = testEmail();
    await authRoute.POST(
      new Request("http://localhost:3000/api/auth/sign-up/email", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "http://localhost:3000" },
        body: JSON.stringify({ name: "Sneaky", email, password: TEST_PASSWORD, platformRole: "SUPER_ADMIN" }),
      }),
    );
    expect(await prisma.user.count({ where: { email, platformRole: "SUPER_ADMIN" } })).toBe(0);
  });
});
