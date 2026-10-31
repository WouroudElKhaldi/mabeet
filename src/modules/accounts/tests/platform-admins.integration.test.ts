import { describe, expect, it } from "vitest";
import { auth } from "@/server/auth/better-auth";
import { resolveContext } from "@/server/auth/resolve-context";
import { createPlace, createUser, prisma, testEmail } from "@tests/integration/helpers";
import { ensurePlatformAdmin } from "../server/platform-admin";

const signsIn = (email: string, password: string) =>
  auth.api
    .signInEmail({ body: { email, password } })
    .then(() => true)
    .catch(() => false);

describe("platform admins", () => {
  it("creates a verified admin who can sign in and manage any place, without being a member", async () => {
    const email = testEmail();
    const { userId, created } = await ensurePlatformAdmin({
      name: "Wouroud",
      email,
      password: "first-password-1",
    });
    const place = await createPlace();

    expect(created).toBe(true);
    expect(await prisma.user.findUniqueOrThrow({ where: { id: userId } })).toMatchObject({
      platformRole: "SUPER_ADMIN",
      emailVerified: true,
    });
    expect(await signsIn(email, "first-password-1")).toBe(true);
    expect(await resolveContext(userId, place.business.id)).toMatchObject({
      platformAdmin: true,
      isOwner: true,
    });
    // Never through an AI key or token.
    expect(await resolveContext(userId, place.business.id, "mcp")).toBeNull();
  });

  it("runs again without making a copy, and only the new password works", async () => {
    const email = testEmail();
    const first = await ensurePlatformAdmin({ name: "Omar", email, password: "first-password-1" });
    const again = await ensurePlatformAdmin({
      name: "Omar",
      email: email.toUpperCase(),
      password: "second-password-2",
    });

    expect(again).toEqual({ userId: first.userId, created: false });
    expect(await prisma.user.count({ where: { email } })).toBe(1);
    expect(await signsIn(email, "first-password-1")).toBe(false);
    expect(await signsIn(email, "second-password-2")).toBe(true);
  });

  it("turns an existing account without a password into an admin who can sign in", async () => {
    const user = await createUser("Fatima");
    await ensurePlatformAdmin({ name: "Fatima", email: user.email, password: "chosen-password-3" });
    expect(await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).toMatchObject({
      platformRole: "SUPER_ADMIN",
    });
    expect(await signsIn(user.email, "chosen-password-3")).toBe(true);
  });
});
