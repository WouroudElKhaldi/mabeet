import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveContext } from "@/server/auth/resolve-context";
import { settleBackgroundWork } from "@/server/background";
import type { Email } from "@/server/email/send";
import { runPayload } from "@/server/jobs/queue";
import { addDays } from "@/utils/dates";
import { createPlace, createUser, prisma, testEmail } from "@tests/integration/helpers";
import {
  acceptInvitation,
  cancelInvitation,
  getInvitation,
  inviteMember,
  listTeamInvitations,
  registerFromInvitation,
} from "../server/invitation-service";
import { createRole, deleteRole } from "../server/team-service";

// A host adds staff by invitation: the person registers (or signs in) from the link and joins with the role the
// host picked.

const sent = vi.hoisted(() => [] as Email[]);
vi.mock(import("@/server/email/send"), async (importOriginal) => ({
  ...(await importOriginal()),
  sendEmail: vi.fn(async (email: Email) => {
    sent.push(email);
  }),
}));

/** The emails sent to one address, once the notify jobs (run in this process in tests) have finished. */
async function emailsTo(address: string) {
  await settleBackgroundWork();
  return sent.filter((email) => email.to === address);
}

afterEach(() => {
  sent.length = 0;
});

describe("team invitations", () => {
  let place: Awaited<ReturnType<typeof createPlace>>;
  let cleanerRole: { id: string };

  beforeEach(async () => {
    place = await createPlace();
    cleanerRole = await createRole(place.ctx, { name: "Cleaner", permissions: ["calendar.read"] });
  });

  const invite = (email = testEmail()) =>
    inviteMember(
      place.ctx,
      { name: "Rana Khalil", email, phone: "+96171555111", roleId: cleanerRole.id },
      "en",
    );
  const tokenOf = async (id: string) => (await prisma.invitation.findUniqueOrThrow({ where: { id } })).token;

  it("lets a new person register from the link and join with the chosen role", async () => {
    const email = testEmail();
    const { id } = await invite(email.toUpperCase());
    const token = await tokenOf(id);
    expect(await getInvitation(token)).toMatchObject({
      status: "PENDING",
      email,
      roleName: "Cleaner",
      hasAccount: false,
    });

    const joined = await registerFromInvitation(
      token,
      { name: "Rana Khalil", phone: "+96171555111", password: "a-long-password" },
      "en",
    );

    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(user).toMatchObject({ emailVerified: true, phone: "+96171555111" });
    const ctx = await resolveContext(user.id, joined.businessId);
    expect(ctx?.permissions.has("calendar.read")).toBe(true);
    expect(ctx?.permissions.has("bookings.decide")).toBe(false);
    expect(await prisma.invitation.findUniqueOrThrow({ where: { id } })).toMatchObject({
      status: "ACCEPTED",
      acceptedById: user.id,
    });
    expect(
      await prisma.activityLog.count({
        where: { businessId: place.business.id, action: "member.invitation_accepted", userId: user.id },
      }),
    ).toBe(1);
    // The link works once.
    await expect(
      registerFromInvitation(
        token,
        { name: "Again", phone: "+96171555111", password: "a-long-password" },
        "en",
      ),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("lets someone with an account accept when signed in with the invited email, and nobody else", async () => {
    const existing = await createUser("Rana");
    const { id } = await invite(existing.email);
    const token = await tokenOf(id);
    expect(await getInvitation(token)).toMatchObject({ hasAccount: true });
    await expect(
      registerFromInvitation(
        token,
        { name: "Rana", phone: "+96171555111", password: "a-long-password" },
        "en",
      ),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    const stranger = await createUser("Stranger");
    await expect(acceptInvitation(stranger, token)).rejects.toMatchObject({ code: "FORBIDDEN" });

    await acceptInvitation(existing, token);
    expect(await resolveContext(existing.id, place.business.id)).not.toBeNull();
  });

  it("refuses expired and cancelled invitations", async () => {
    const { id } = await invite();
    const token = await tokenOf(id);
    const later = addDays(new Date(), 8);
    expect(await getInvitation(token, later)).toMatchObject({ status: "EXPIRED" });
    await expect(
      registerFromInvitation(
        token,
        { name: "Rana", phone: "+96171555111", password: "a-long-password" },
        "en",
        later,
      ),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    const second = await invite();
    await cancelInvitation(place.ctx, second.id);
    const cancelled = await tokenOf(second.id);
    expect(await getInvitation(cancelled)).toMatchObject({ status: "CANCELLED" });
    await expect(
      registerFromInvitation(
        cancelled,
        { name: "Other", phone: "+96171555112", password: "a-long-password" },
        "en",
      ),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    // The first link was used after it ran out, so it is now stored as expired.
    expect((await listTeamInvitations(place.ctx)).map((row) => row.status).sort()).toEqual([
      "CANCELLED",
      "EXPIRED",
    ]);
  });

  it("sends one waiting invitation per person, and keeps its role from being deleted", async () => {
    const email = testEmail();
    await invite(email);
    await expect(invite(email)).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(deleteRole(place.ctx, cleanerRole.id)).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("emails the link to the invited person, and tells the host once they join", async () => {
    const email = testEmail();
    const { id } = await invite(email);
    const token = await tokenOf(id);
    const [letter, ...others] = await emailsTo(email);
    expect(others).toEqual([]);
    expect(letter).toMatchObject({
      subject: "Beit Test owner invited you to join Beit Test",
      idempotencyKey: `invitation-${id}`,
      replyTo: place.owner.email,
    });
    expect(letter?.text).toContain("Hello Rana");
    expect(letter?.text).toContain(`/invite/${token}`);
    expect(letter?.text).toContain("as Cleaner");

    await registerFromInvitation(
      token,
      { name: "Rana Khalil", phone: "+96171555111", password: "a-long-password" },
      "en",
    );
    const [joined] = await emailsTo(place.owner.email);
    expect(joined).toMatchObject({
      subject: "Rana Khalil accepted your invitation",
      idempotencyKey: `invitation-accepted-${id}`,
    });
  });

  it("writes the invitation in Arabic, right to left, when the host invites from the Arabic site", async () => {
    const email = testEmail();
    await inviteMember(
      place.ctx,
      { name: "Rana Khalil", email, phone: "+96171555111", roleId: cleanerRole.id },
      "ar-LB",
    );
    const [letter] = await emailsTo(email);
    expect(letter?.subject).toBe("Beit Test owner يدعوك للانضمام إلى فريق Beit Test");
    expect(letter?.html).toContain('dir="rtl"');
  });

  it("sends nothing for an invitation cancelled before its email went out", async () => {
    const email = testEmail();
    const { id } = await invite(email);
    await emailsTo(email);
    sent.length = 0;
    await cancelInvitation(place.ctx, id);
    // The worker picks the job up late: it reads the invitation fresh and finds it cancelled.
    await expect(
      runPayload({ job: "notify.invitation", data: { invitationId: id } }, "job-1"),
    ).resolves.toEqual({ ok: true, result: undefined });
    expect(await emailsTo(email)).toEqual([]);
  });

  it("keeps a Free team to two people, and creates no account for someone who can no longer join", async () => {
    const first = testEmail();
    const second = testEmail();
    const firstToken = await tokenOf((await invite(first)).id);
    const secondToken = await tokenOf((await invite(second)).id);
    await registerFromInvitation(
      firstToken,
      { name: "Rana Khalil", phone: "+96171555111", password: "a-long-password" },
      "en",
    );

    await expect(invite()).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      registerFromInvitation(
        secondToken,
        { name: "Karim Saad", phone: "+96171555112", password: "a-long-password" },
        "en",
      ),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await prisma.user.count({ where: { email: second } })).toBe(0);
    expect(await getInvitation(secondToken)).toMatchObject({ status: "PENDING", hasAccount: false });
  });
});
