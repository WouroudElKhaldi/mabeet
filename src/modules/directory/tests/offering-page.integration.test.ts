import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { getSessionBookingForGuest, requestSessionBooking } from "@/modules/bookings/server";
import sharp from "sharp";
import { listPlacePhotos, uploadPhoto } from "@/modules/rooms/server";
import { createPlace, createUser, memberWith, prisma } from "@tests/integration/helpers";
import { browseOfferings } from "../server";
import { getOfferingPage } from "../server/offering-page-service";

// The guest's side of experiences and services on the real database: an offering's page shows its upcoming sessions
// with the seats left in each (held and confirmed seats count, a hold past its time does not), the browse tabs list
// only listed places' offerings of the tab's kind, and a booking's private link opens the seats for their guest only.

const DAY_MS = 24 * 3_600_000;

async function placeWithOffering(kind: "EXPERIENCE" | "SERVICE" = "EXPERIENCE", listed = true) {
  const place = await createPlace("Beit Offerings");
  await prisma.business.update({ where: { id: place.business.id }, data: { listedPublicly: listed } });
  const offering = await prisma.offering.create({
    data: {
      businessId: place.business.id,
      kind,
      slug: `cedar-hike-${randomUUID()}`,
      title: "Cedar hike",
      durationMinutes: 180,
      priceCents: 3_000,
      priceUnit: "PER_PERSON",
      maxGuests: 6,
    },
  });
  const sessionAt = (days: number, capacity = 8) => {
    const startsAt = new Date(Date.now() + days * DAY_MS);
    return prisma.offeringSession.create({
      data: {
        businessId: place.business.id,
        offeringId: offering.id,
        startsAt,
        endsAt: new Date(startsAt.getTime() + 3 * 3_600_000),
        capacity,
      },
    });
  };
  return { ...place, offering, sessionAt };
}

const seats = (slug: string, sessionId: string, count: number, guestUserId: string) =>
  requestSessionBooking({
    offeringSlug: slug,
    sessionId,
    seats: count,
    guestName: "Maya Haddad",
    guestPhone: "+96171123456",
    guestEmail: null,
    guestNote: null,
    guestUserId,
  });

describe("an experience's page", () => {
  it("shows the upcoming sessions with the seats left, not counting a hold past its time", async () => {
    const place = await placeWithOffering();
    const guest = await createUser("Maya Haddad");
    await place.sessionAt(-1);
    const soon = await place.sessionAt(3);
    const later = await place.sessionAt(10, 4);
    await seats(place.offering.slug, soon.id, 3, guest.id);
    const lapsed = await seats(place.offering.slug, later.id, 2, guest.id);
    await prisma.sessionBooking.update({
      where: { id: lapsed.id },
      data: { holdExpiresAt: new Date(Date.now() - 60_000) },
    });

    const page = await getOfferingPage(place.offering.slug);

    expect(page).toMatchObject({ title: "Cedar hike", kind: "EXPERIENCE", priceCents: 3_000 });
    expect(page?.sessions).toEqual([
      { id: soon.id, startsAt: soon.startsAt.toISOString(), seatsLeft: 5 },
      { id: later.id, startsAt: later.startsAt.toISOString(), seatsLeft: 4 },
    ]);
  });

  it("is not found once the host switches it off", async () => {
    const place = await placeWithOffering();
    await prisma.offering.update({ where: { id: place.offering.id }, data: { active: false } });
    expect(await getOfferingPage(place.offering.slug)).toBeNull();
  });
});

describe("browsing experiences and services", () => {
  it("lists the kind asked for from listed places only, the ones with a date first", async () => {
    const dated = await placeWithOffering("SERVICE");
    await dated.sessionAt(2);
    const undated = await placeWithOffering("SERVICE");
    const unlisted = await placeWithOffering("SERVICE", false);
    const experience = await placeWithOffering("EXPERIENCE");

    const found = await browseOfferings("SERVICE", 500);
    const slugs = found.map((card) => card.slug);

    expect(slugs).toContain(dated.offering.slug);
    expect(slugs).toContain(undated.offering.slug);
    expect(slugs).not.toContain(unlisted.offering.slug);
    expect(slugs).not.toContain(experience.offering.slug);
    expect(slugs.indexOf(dated.offering.slug)).toBeLessThan(slugs.indexOf(undated.offering.slug));
    expect(found.find((card) => card.slug === dated.offering.slug)?.nextStartsAt).toBeInstanceOf(Date);
  });
});

describe("the seats' private link", () => {
  it("opens the seats for the guest who booked them, and for nobody else", async () => {
    const place = await placeWithOffering();
    const guest = await createUser("Maya Haddad");
    const stranger = await createUser("Someone Else");
    const session = await place.sessionAt(5);
    const booking = await seats(place.offering.slug, session.id, 2, guest.id);

    expect(await getSessionBookingForGuest(booking.publicToken, guest.id)).toMatchObject({
      seats: 2,
      offering: { title: "Cedar hike" },
    });
    expect(await getSessionBookingForGuest(booking.publicToken, stranger.id)).toBeNull();
  });
});

describe("an experience's photos, reviews and host", () => {
  it("shows the photos uploaded to it, its own reviews, and the place's host", async () => {
    const place = await placeWithOffering();
    const guest = await createUser("Rami Khoury");
    const session = await place.sessionAt(2);
    const png = await sharp({
      create: { width: 8, height: 8, channels: 3, background: { r: 20, g: 120, b: 80 } },
    })
      .png()
      .toBuffer();
    const photo = await uploadPhoto(place.ctx, {
      roomId: null,
      offeringId: place.offering.id,
      bytes: new Uint8Array(png),
      alt: "On the trail",
      area: null,
    });
    const booked = await seats(place.offering.slug, session.id, 2, guest.id);
    await prisma.review.create({
      data: {
        businessId: place.business.id,
        offeringId: place.offering.id,
        sessionBookingId: booked.id,
        authorId: guest.id,
        rating: 5,
        comment: "A beautiful walk",
      },
    });

    const page = await getOfferingPage(place.offering.slug);
    expect(page?.photos.map((shown) => shown.id)).toEqual([photo.id]);
    expect(page?.reviews).toMatchObject([
      { rating: 5, comment: "A beautiful walk", authorName: "Rami Khoury" },
    ]);
    expect(page?.host).toMatchObject({ response: null });
    // The place's own gallery stays the place's: an experience's photo is never shown on the place.
    expect(await listPlacePhotos(place.business.id)).toEqual([]);
  });

  it("refuses an experience photo to a member without offerings.manage", async () => {
    const place = await placeWithOffering();
    const member = await memberWith(place.business.id, ["rooms.manage"]);
    await expect(
      uploadPhoto(member, {
        roomId: null,
        offeringId: place.offering.id,
        bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
        alt: null,
        area: null,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
