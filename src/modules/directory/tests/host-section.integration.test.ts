import { randomUUID } from "node:crypto";
import type { BookingMode, BookingStatus, Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { addRoom, createPlace, createUser, prisma, stay } from "@tests/integration/helpers";
import { addDays } from "@/utils/dates";
import { getPlace } from "../server";

// The host on a place's page, on the real database: their profile only when they show it, how guests may reach
// them always, and how they answer requests, counted only over requests that really waited for them.

type Place = Awaited<ReturnType<typeof createPlace>>;

const NOW = new Date("2026-11-09T12:00:00Z");
const minutesAfter = (date: Date, minutes: number) => new Date(date.getTime() + minutes * 60_000);

/** Writes the owner's host profile straight to the database: the profile form is the dashboard's. */
function hostProfile(userId: string, data: Partial<Prisma.HostProfileUncheckedCreateInput> = {}) {
  return prisma.hostProfile.create({
    data: {
      userId,
      displayName: "Rana",
      bio: "Born in Ehden, hosting since my kids left home.",
      city: "Ehden",
      languages: ["ar", "en", "fr"],
      hostingSince: 2019,
      showOnListings: true,
      ...data,
    },
  });
}

/**
 * A finished request, written straight to the database the way the engine leaves it: when it was made, what it
 * became, who decided it and when, and whether a payment came in.
 */
async function pastRequest(
  place: Place,
  roomId: string,
  {
    mode,
    status,
    createdAt,
    decidedAfterMinutes,
    paidAfterMinutes,
  }: {
    mode: BookingMode;
    status: BookingStatus;
    createdAt: Date;
    decidedAfterMinutes?: number;
    paidAfterMinutes?: number;
  },
) {
  const guest = await createUser("Maya Haddad");
  const range = stay(30, 2, NOW);
  const booking = await prisma.booking.create({
    data: {
      reference: randomUUID().slice(0, 12),
      publicToken: randomUUID(),
      businessId: place.business.id,
      roomId,
      guestUserId: guest.id,
      guestName: guest.name,
      guestPhone: "+96171123456",
      guestCount: 2,
      checkIn: range.checkIn,
      checkOut: range.checkOut,
      totalCents: 20_000,
      currency: "USD",
      bookingMode: mode,
      status,
      createdAt,
      ...(decidedAfterMinutes === undefined
        ? {}
        : { decidedById: place.owner.id, decidedAt: minutesAfter(createdAt, decidedAfterMinutes) }),
    },
  });
  if (paidAfterMinutes !== undefined) {
    await prisma.payment.create({
      data: {
        businessId: place.business.id,
        bookingId: booking.id,
        amountCents: 20_000,
        currency: "USD",
        method: "WHISH",
        status: "PAID",
        paidAt: minutesAfter(createdAt, paidAfterMinutes),
      },
    });
  }
  return booking;
}

const daysAgo = (days: number) => addDays(NOW, -days);

describe("the host on a place's page", () => {
  it("is reached both ways and shows nothing personal when they never wrote a profile", async () => {
    const place = await createPlace();
    await addRoom(place.business.id);
    const page = await getPlace(place.business.slug, NOW);
    expect(page?.host).toEqual({ contactBy: "BOTH", profile: null, response: null });
  });

  it("keeps a hidden profile private, but still follows how the host wants to be reached", async () => {
    const place = await createPlace();
    await hostProfile(place.owner.id, { showOnListings: false, contactBy: "WHATSAPP" });
    const page = await getPlace(place.business.slug, NOW);
    expect(page?.host).toMatchObject({ contactBy: "WHATSAPP", profile: null });
    expect(JSON.stringify(page)).not.toContain("Born in Ehden");
  });

  it("shows a profile the host turned on, never their own email or phone", async () => {
    const place = await createPlace();
    await prisma.user.update({ where: { id: place.owner.id }, data: { phone: "+96103999888" } });
    await prisma.business.update({ where: { id: place.business.id }, data: { whatsapp: "+96171000111" } });
    await hostProfile(place.owner.id, { contactBy: "MESSAGE" });

    const page = await getPlace(place.business.slug, NOW);
    expect(page?.whatsapp).toBe("+96171000111");
    expect(page?.host).toMatchObject({
      contactBy: "MESSAGE",
      profile: {
        name: "Rana",
        bio: "Born in Ehden, hosting since my kids left home.",
        city: "Ehden",
        languages: ["ar", "en", "fr"],
        hostingSince: 2019,
      },
    });
    const text = JSON.stringify(page);
    expect(text).not.toContain(place.owner.email);
    expect(text).not.toContain("+96103999888");
  });

  it("uses the account name when the host left the shown name empty", async () => {
    const place = await createPlace("Beit Rana");
    await hostProfile(place.owner.id, { displayName: "  " });
    expect((await getPlace(place.business.slug, NOW))?.host.profile?.name).toBe("Beit Rana owner");
  });

  it("is the place's first owner, even after another owner joins", async () => {
    const place = await createPlace();
    await hostProfile(place.owner.id, { displayName: "First owner" });
    const second = await createUser("Second owner");
    await hostProfile(second.id, { displayName: "Second owner" });
    const ownerRole = await prisma.role.findFirstOrThrow({
      where: { businessId: place.business.id, isOwner: true },
    });
    await prisma.membership.create({
      data: { userId: second.id, businessId: place.business.id, roleId: ownerRole.id },
    });
    expect((await getPlace(place.business.slug, NOW))?.host.profile?.name).toBe("First owner");
  });

  it("treats a deleted profile as no profile", async () => {
    const place = await createPlace();
    await hostProfile(place.owner.id, { contactBy: "WHATSAPP", isDeleted: true });
    expect((await getPlace(place.business.slug, NOW))?.host).toMatchObject({
      contactBy: "BOTH",
      profile: null,
    });
  });
});

describe("how the host answers requests", () => {
  it("counts the requests that waited for the host: answered ones and the ones that expired waiting", async () => {
    const place = await createPlace();
    const room = await addRoom(place.business.id);
    // Answered offline after 30 minutes and 2 hours; one offline request expired unanswered.
    await pastRequest(place, room.id, {
      mode: "OFFLINE",
      status: "CONFIRMED",
      createdAt: daysAgo(40),
      decidedAfterMinutes: 30,
    });
    await pastRequest(place, room.id, {
      mode: "OFFLINE",
      status: "DECLINED",
      createdAt: daysAgo(30),
      decidedAfterMinutes: 120,
    });
    await pastRequest(place, room.id, { mode: "OFFLINE", status: "EXPIRED", createdAt: daysAgo(20) });
    // Mode 2, paid after 5 minutes, answered 45 minutes after the payment: the clock starts at the payment.
    await pastRequest(place, room.id, {
      mode: "ONLINE_APPROVAL",
      status: "CONFIRMED",
      createdAt: daysAgo(10),
      paidAfterMinutes: 5,
      decidedAfterMinutes: 50,
    });
    // Mode 2, paid, then expired waiting for the host: missed.
    await pastRequest(place, room.id, {
      mode: "ONLINE_APPROVAL",
      status: "EXPIRED",
      createdAt: daysAgo(5),
      paidAfterMinutes: 3,
    });

    const response = (await getPlace(place.business.slug, NOW))?.host.response;
    // 3 answered of 5; answer times 30, 45 and 120 minutes, so the middle one is 45.
    expect(response).toEqual({ rate: 3 / 5, medianMinutes: 45 });
  });

  it("leaves out what never asked the host: automatic bookings, unpaid mode 2 requests and cancellations", async () => {
    const place = await createPlace();
    const room = await addRoom(place.business.id);
    for (const minutes of [10, 20, 30]) {
      await pastRequest(place, room.id, {
        mode: "OFFLINE",
        status: "CONFIRMED",
        createdAt: daysAgo(minutes),
        decidedAfterMinutes: minutes,
      });
    }
    await pastRequest(place, room.id, {
      mode: "AUTOMATIC",
      status: "CONFIRMED",
      createdAt: daysAgo(3),
      paidAfterMinutes: 2,
    });
    await pastRequest(place, room.id, { mode: "AUTOMATIC", status: "EXPIRED", createdAt: daysAgo(3) });
    // Nobody paid within the 10 minutes: the host never saw it.
    await pastRequest(place, room.id, { mode: "ONLINE_APPROVAL", status: "EXPIRED", createdAt: daysAgo(4) });
    // Cancelled: a later cancellation overwrites when it was decided, so it says nothing about answering.
    await pastRequest(place, room.id, {
      mode: "OFFLINE",
      status: "CANCELLED",
      createdAt: daysAgo(6),
      decidedAfterMinutes: 5000,
    });

    expect((await getPlace(place.business.slug, NOW))?.host.response).toEqual({ rate: 1, medianMinutes: 20 });
  });

  it("only counts the past year, and says nothing with fewer than three requests", async () => {
    const place = await createPlace();
    const room = await addRoom(place.business.id);
    await pastRequest(place, room.id, { mode: "OFFLINE", status: "EXPIRED", createdAt: daysAgo(400) });
    await pastRequest(place, room.id, { mode: "OFFLINE", status: "EXPIRED", createdAt: daysAgo(380) });
    await pastRequest(place, room.id, {
      mode: "OFFLINE",
      status: "CONFIRMED",
      createdAt: daysAgo(10),
      decidedAfterMinutes: 15,
    });
    await pastRequest(place, room.id, { mode: "OFFLINE", status: "EXPIRED", createdAt: daysAgo(8) });
    expect((await getPlace(place.business.slug, NOW))?.host.response).toBeNull();
  });

  it("only counts the place's own requests", async () => {
    const mine = await createPlace();
    const other = await createPlace();
    const room = await addRoom(other.business.id);
    for (const days of [3, 4, 5]) {
      await pastRequest(other, room.id, { mode: "OFFLINE", status: "EXPIRED", createdAt: daysAgo(days) });
    }
    expect((await getPlace(mine.business.slug, NOW))?.host.response).toBeNull();
  });
});
