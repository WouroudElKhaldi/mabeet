import { afterEach, describe, expect, it, vi } from "vitest";
import * as messagesRoute from "@/app/api/public/places/[slug]/messages/route";
import { createPlace, memberWith, prisma } from "@tests/integration/helpers";
import { settleBackgroundWork } from "@/server/background";
import type { Email } from "@/server/email/send";
import { resetMemoryRateLimits } from "@/server/http/rate-limit";

// The Contact host page: a guest's question reaches the people who can decide the place's bookings, as an email they
// answer with Reply, only when the host takes questions that way, and one address cannot flood the hosts.

const sent = vi.hoisted(() => [] as Email[]);
vi.mock(import("@/server/email/send"), async (importOriginal) => ({
  ...(await importOriginal()),
  sendEmail: vi.fn(async (email: Email) => {
    sent.push(email);
  }),
}));

const question = {
  name: "Maya Haddad",
  email: "maya@example.com",
  message: "Hello! Is there parking near the house?\nWe arrive by car from Beirut.",
};

/** Posts the form from one visitor's address, in Arabic, the way the browser does. */
async function ask(slug: string, body: unknown, address = "203.0.113.7") {
  const request = new Request(`http://localhost/api/public/places/${slug}/messages`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-real-ip": address, cookie: "locale=ar" },
    body: JSON.stringify(body),
  });
  const response = await messagesRoute.POST(request, { params: Promise.resolve({ slug }) });
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

/** The emails sent to one address, once the notify jobs have finished. */
async function emailsTo(address: string) {
  await settleBackgroundWork();
  return sent.filter((email) => [email.to].flat().includes(address));
}

afterEach(async () => {
  await settleBackgroundWork();
  sent.length = 0;
  resetMemoryRateLimits();
});

describe("asking a host a question", () => {
  it("emails the people who decide bookings, with the guest as the reply address", async () => {
    const place = await createPlace("Beit Ehden");
    const decider = await memberWith(place.business.id, ["bookings.decide"]);
    const reader = await memberWith(place.business.id, ["bookings.read"]);
    const [deciderUser, readerUser] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { id: decider.userId } }),
      prisma.user.findUniqueOrThrow({ where: { id: reader.userId } }),
    ]);

    const response = await ask(place.business.slug, {
      ...question,
      checkIn: "2026-12-20",
      checkOut: "2026-12-23",
      guests: 3,
    });
    expect(response).toEqual({ status: 202, body: { sent: true } });

    const [email, ...more] = await emailsTo(place.owner.email);
    expect(more).toEqual([]);
    expect(email).toMatchObject({ replyTo: "maya@example.com" });
    expect(email?.subject).toBe("Question about Beit Ehden from Maya Haddad");
    expect(email?.idempotencyKey).toMatch(/^host-message-.+-en$/);
    // Each line of the question is its own paragraph; the stay, the guests and the guest's language are details.
    expect(email?.text).toContain("Is there parking near the house?");
    expect(email?.text).toContain("We arrive by car from Beirut.");
    expect(email?.text).toContain("3");
    expect(email?.text).toContain("Arabic");
    expect(await emailsTo(deciderUser.email)).toHaveLength(1);
    expect(await emailsTo(readerUser.email)).toEqual([]);
  });

  it("writes to each host in their own language", async () => {
    const place = await createPlace("Beit Ehden");
    await prisma.user.update({ where: { id: place.owner.id }, data: { locale: "ar-LB" } });
    await ask(place.business.slug, question);
    const [email] = await emailsTo(place.owner.email);
    expect(email?.subject).toBe("سؤال عن Beit Ehden من Maya Haddad");
    expect(email?.idempotencyKey).toMatch(/-ar$/);
  });

  it("is refused when the host answers on WhatsApp only, and sends nothing", async () => {
    const place = await createPlace();
    await prisma.hostProfile.create({ data: { userId: place.owner.id, contactBy: "WHATSAPP" } });
    const response = await ask(place.business.slug, question);
    expect(response.status).toBe(403);
    expect(await emailsTo(place.owner.email)).toEqual([]);
  });

  it("is taken when the host chose Contact host only, even with their profile hidden", async () => {
    const place = await createPlace();
    await prisma.hostProfile.create({
      data: { userId: place.owner.id, contactBy: "MESSAGE", showOnListings: false },
    });
    expect((await ask(place.business.slug, question)).status).toBe(202);
    expect(await emailsTo(place.owner.email)).toHaveLength(1);
  });

  it("does not know a paused place", async () => {
    const place = await createPlace();
    await prisma.business.update({ where: { id: place.business.id }, data: { status: "SUSPENDED" } });
    expect((await ask(place.business.slug, question)).status).toBe(404);
    expect((await ask("no-such-place", question)).status).toBe(404);
    expect(await emailsTo(place.owner.email)).toEqual([]);
  });

  it("names the wrong fields, and sends nothing", async () => {
    const place = await createPlace();
    const response = await ask(place.business.slug, { name: "M", email: "not-an-email", message: "Hi" });
    expect(response.status).toBe(400);
    const details = (response.body.error as { details: { fieldErrors: Record<string, unknown> } }).details;
    expect(Object.keys(details.fieldErrors).sort()).toEqual(["email", "message", "name"]);
    expect(await emailsTo(place.owner.email)).toEqual([]);
  });

  it("takes dates only as a pair a guest could book", async () => {
    const place = await createPlace();
    for (const dates of [
      { checkIn: "2026-12-20" },
      { checkOut: "2026-12-20" },
      { checkIn: "2026-12-20", checkOut: "2026-12-20" },
      { checkIn: "2026-12-20", checkOut: "2026-12-18" },
    ]) {
      resetMemoryRateLimits();
      expect((await ask(place.business.slug, { ...question, ...dates })).status, JSON.stringify(dates)).toBe(
        400,
      );
    }
  });

  it("takes five questions an hour from one address, across all places, then asks to slow down", async () => {
    const first = await createPlace();
    const second = await createPlace();
    for (let count = 0; count < 5; count++)
      expect((await ask(first.business.slug, question)).status).toBe(202);
    expect((await ask(second.business.slug, question)).status).toBe(429);
    // Someone else is not held back by it.
    expect((await ask(second.business.slug, question, "198.51.100.4")).status).toBe(202);
  });
});
