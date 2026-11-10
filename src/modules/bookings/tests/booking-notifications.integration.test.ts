import { afterEach, describe, expect, it, vi } from "vitest";
import { prisma, stay } from "@tests/integration/helpers";
import { settleBackgroundWork } from "@/server/background";
import type { Email } from "@/server/email/send";
import { runHousekeeping } from "@/modules/housekeeping/server";
import {
  addBlock,
  cancelBookingAsGuest,
  cancelStayAsGuest,
  confirmBooking,
  declineBooking,
  requestBooking,
  requestSessionBooking,
} from "../server";
import { importStay, placeWithRoom, placeWithSession, requestFor, seatsFor } from "./fixtures";

// The booking emails, as the worker sends them (jobs run in the test process). The guest hears about every change;
// the people who decide bookings hear about new requests, guest cancellations and platform clashes.

const sent = vi.hoisted(() => [] as Email[]);
vi.mock(import("@/server/email/send"), async (importOriginal) => ({
  ...(await importOriginal()),
  sendEmail: vi.fn(async (email: Email) => {
    sent.push(email);
  }),
}));

/** The emails sent to one address, once the notify jobs have finished. */
async function emailsTo(address: string) {
  await settleBackgroundWork();
  return sent.filter((email) => [email.to].flat().includes(address));
}

afterEach(() => {
  sent.length = 0;
});

const GUEST_EMAIL = "maya@guesthouse.test";

describe("booking emails", () => {
  it("offline: the guest gets a receipt with how to pay the host, and the owner gets the request", async () => {
    const place = await placeWithRoom("OFFLINE");
    await prisma.business.update({
      where: { id: place.business.id },
      data: { paymentInstructions: "Whish to 70 123 456" },
    });
    const booking = await requestBooking({ ...requestFor(place, stay(10, 2)), guestEmail: GUEST_EMAIL });

    const [receipt, ...more] = await emailsTo(GUEST_EMAIL);
    expect(more).toEqual([]);
    expect(receipt).toMatchObject({
      subject: `Your request to ${place.business.name} (${booking.reference})`,
      idempotencyKey: `requested-guest-${booking.id}`,
    });
    expect(receipt?.text).toContain("Whish to 70 123 456");
    expect(receipt?.text).toContain(`/b/${booking.publicToken}`);

    const [request] = await emailsTo(place.owner.email);
    expect(request?.subject).toMatch(/^New request: Maya Haddad, /);
    expect(request?.text).toContain("pays you");
  });

  it("online: the guest is asked to pay within the window, and the owner is not bothered before the payment", async () => {
    const place = await placeWithRoom("ONLINE_APPROVAL");
    await requestBooking({ ...requestFor(place, stay(10, 2)), guestEmail: GUEST_EMAIL });
    const [pay] = await emailsTo(GUEST_EMAIL);
    expect(pay?.subject).toMatch(/^Pay to secure your booking: /);
    expect(pay?.text).toContain("Whish or a card");
    expect(await emailsTo(place.owner.email)).toEqual([]);
  });

  it("tells the guest when the owner confirms or declines", async () => {
    const place = await placeWithRoom();
    const first = await requestBooking({ ...requestFor(place, stay(10, 2)), guestEmail: GUEST_EMAIL });
    await confirmBooking(place.ctx, { bookingId: first.id });
    const second = await requestBooking({ ...requestFor(place, stay(20, 2)), guestEmail: GUEST_EMAIL });
    await declineBooking(place.ctx, { bookingId: second.id });
    const subjects = (await emailsTo(GUEST_EMAIL)).map((email) => email.subject);
    expect(subjects).toContain(`Confirmed: ${place.business.name} (${first.reference})`);
    expect(subjects).toContain(`Not available: ${place.business.name} (${second.reference})`);
  });

  it("explains an unpaid booking that ran out differently from a request the owner never answered", async () => {
    const online = await placeWithRoom("AUTOMATIC");
    const offline = await placeWithRoom("OFFLINE");
    const now = new Date();
    await requestBooking({ ...requestFor(online, stay(10, 2)), guestEmail: GUEST_EMAIL }, now);
    await requestBooking({ ...requestFor(offline, stay(10, 2)), guestEmail: GUEST_EMAIL }, now);
    await runHousekeeping(new Date(now.getTime() + 25 * 3_600_000));
    const subjects = (await emailsTo(GUEST_EMAIL)).map((email) => email.subject);
    expect(
      subjects.some((subject) => subject.startsWith(`Payment time ran out: ${online.business.name}`)),
    ).toBe(true);
    expect(subjects.some((subject) => subject.startsWith(`Request expired: ${offline.business.name}`))).toBe(
      true,
    );
  });

  it("tells the owner when the guest cancels, with their reason", async () => {
    const place = await placeWithRoom();
    const booking = await requestBooking(requestFor(place, stay(10, 2)));
    await cancelStayAsGuest(booking.publicToken, place.guest.id, "Flight cancelled");
    const toOwner = await emailsTo(place.owner.email);
    const cancelled = toOwner.find((email) => email.subject.startsWith("Cancelled by the guest"));
    expect(cancelled?.text).toContain('Their reason: "Flight cancelled"');
  });

  it("writes to an Arabic-speaking guest in Arabic, right to left", async () => {
    const place = await placeWithRoom();
    await requestBooking({ ...requestFor(place, stay(10, 2), { locale: "ar-LB" }), guestEmail: GUEST_EMAIL });
    const [receipt] = await emailsTo(GUEST_EMAIL);
    expect(receipt?.subject).toMatch(/^طلبك لدى /);
    expect(receipt?.html).toContain('dir="rtl"');
  });

  it("warns the owner once about a platform stay over nights they already closed", async () => {
    const place = await placeWithRoom();
    await importStay(place, place.room.id, stay(10, 3));
    await addBlock(place.ctx, { roomId: place.room.id, range: stay(11, 1), note: "Phone booking" });
    await addBlock(place.ctx, { roomId: place.room.id, range: stay(30, 1), note: null });
    const clashes = (await emailsTo(place.owner.email)).filter((email) =>
      email.subject.startsWith("Calendar clash"),
    );
    expect(clashes).toHaveLength(1);
    expect(clashes[0]?.text).toContain("Phone booking");
  });
});

describe("emails about seats", () => {
  it("speak of seats and the session's time, and the host hears when the guest cancels", async () => {
    const place = await placeWithSession("OFFLINE");
    const booking = await requestSessionBooking({ ...seatsFor(place, 2), guestEmail: GUEST_EMAIL });

    const [receipt] = await emailsTo(GUEST_EMAIL);
    expect(receipt?.text).toContain(`Your seats at ${place.business.name} are held`);
    expect(receipt?.text).toContain("Wine tasting in the Bekaa");
    const [request] = await emailsTo(place.owner.email);
    expect(request?.text).toContain("The seats are held for the guest");

    sent.length = 0;
    await cancelBookingAsGuest(booking.publicToken, place.guest.id, "Change of plans");
    const [cancelled] = await emailsTo(place.owner.email);
    expect(cancelled?.subject).toMatch(/^Cancelled by the guest: Maya Haddad, /);
    expect(cancelled?.text).toContain("The seats are free again.");
  });
});
