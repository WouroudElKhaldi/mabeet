import { describe, expect, it } from "vitest";
import * as deleteRoute from "@/app/api/me/delete/route";
import * as exportRoute from "@/app/api/me/export/route";
import { listMembers } from "@/modules/team/server";
import { auth } from "@/server/auth/better-auth";
import { createPlace, memberWith, prisma } from "@tests/integration/helpers";
import { call, signUp, TEST_PASSWORD } from "@tests/integration/http";
import { deleteMyAccount, exportMyData } from "../server/account-service";

// Nothing is deleted: an account is marked deleted, its email is freed, and its sessions end.

describe("closing an account", () => {
  it("marks the person deleted, frees their email and signs them out everywhere", async () => {
    const guest = await signUp("Maya Haddad");

    const closed = await call(deleteRoute.POST, { as: guest, body: { email: guest.email.toUpperCase() } });

    expect(closed.status).toBe(200);
    const after = await prisma.user.findUniqueOrThrow({ where: { id: guest.userId } });
    expect(after).toMatchObject({ isDeleted: true, deletedEmail: guest.email });
    expect(after.email).not.toBe(guest.email);
    expect(await prisma.session.count({ where: { userId: guest.userId } })).toBe(0);
    expect((await call(exportRoute.GET, { as: guest })).status).toBe(401);
    // The freed email can sign up again, as a new account.
    const again = await auth.api.signUpEmail({
      body: { name: "Maya again", email: guest.email, password: TEST_PASSWORD },
    });
    expect(again.user.id).not.toBe(guest.userId);
  });

  it("needs the person's own email typed exactly", async () => {
    const guest = await signUp("Karim Saad");
    const refused = await call(deleteRoute.POST, { as: guest, body: { email: "someone@else.test" } });
    expect(refused.status).toBe(400);
    expect(await prisma.user.findUniqueOrThrow({ where: { id: guest.userId } })).toMatchObject({
      isDeleted: false,
    });
  });

  it("refuses while the person is the only owner of a place", async () => {
    const place = await createPlace("Beyt El Jabal");
    await expect(deleteMyAccount(place.owner, place.owner.email)).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("takes a deleted member off the team list, keeping the row", async () => {
    const place = await createPlace();
    const staff = await memberWith(place.business.id, ["bookings.read"]);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: staff.userId } });

    await deleteMyAccount(user, user.email);

    expect((await listMembers(place.ctx)).map((member) => member.userId)).not.toContain(user.id);
    expect(await prisma.membership.findUniqueOrThrow({ where: { id: staff.membershipId } })).toMatchObject({
      status: "REMOVED",
      isDeleted: true,
    });
  });
});

describe("downloading my data", () => {
  it("gives the signed-in person their own data as a file, and nobody else's", async () => {
    const guest = await signUp("Rana Khalil");
    const other = await signUp("Someone Else");

    const response = await exportRoute.GET(
      new Request("http://localhost/api/me/export", {
        headers: { cookie: guest.cookie },
      }),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toMatch(/attachment; filename="mabeet-my-data-/);
    const data = (await response.json()) as { email: string; name: string };
    expect(data).toMatchObject({ email: guest.email, name: "Rana Khalil" });
    expect(JSON.stringify(data)).not.toContain(other.email);
    await expect(exportMyData(other.userId)).resolves.toMatchObject({ email: other.email });
  });
});
