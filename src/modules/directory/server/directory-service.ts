import { BOOKABLE_ROOM_KIND, MAX_STAY_NIGHTS } from "@/config/booking-limits";
import {
  findFreeRooms,
  getResponseStats,
  getTakenNights,
  listMyBookings,
  stayIssue,
} from "@/modules/bookings/server";
import {
  findPlaceCovers,
  findRoomForBooking,
  findSearchUnits,
  listPlacePhotos,
  listPublicUnits,
  priceStay,
  priceStays,
} from "@/modules/rooms/server";
import { findReviewedBookings, getPlaceRating, listPlaceReviews } from "@/modules/reviews/server";
import {
  findBookablePlace,
  getHostSection,
  getPublicPlace,
  listListedPlaces,
  listPlacesByIds,
} from "@/modules/workspaces/server";
import { notFound } from "@/server/errors";
import { addDays, countNights, type DateRange, toIsoDate, todayUtc } from "@/utils/dates";
import { MIN_REQUESTS_FOR_RESPONSE, RESPONSE_WINDOW_DAYS } from "../host";
import type { PlaceSearch } from "../search-query";
import type {
  GuestTrip,
  PlaceAvailability,
  PlaceCard,
  PublicHost,
  PublicPhoto,
  PublicPlace,
  RoomAvailability,
  RoomQuote,
  SearchOffer,
} from "../types";

// The public side: what a guest can see and ask before signing in. Nothing here takes or frees nights; the booking
// engine does. Whether a stay can be booked is the engine's own rule (`stayIssue`), so a quote never promises what
// booking would refuse.

/**
 * The price of a stay in a room, and whether it can be booked as asked. A stay that cannot still gets its price
 * (the screen can show both) unless it is too long to price at all.
 */
export async function quoteRoom(
  slug: string,
  roomId: string,
  { range, guests }: { range: DateRange; guests: number | null },
  now: Date = new Date(),
): Promise<RoomQuote> {
  const place = await findBookablePlace(slug);
  if (!place) throw notFound("Place");
  const room = await findRoomForBooking(place.id, roomId);
  // A room the host switched off, or one the place does not book by (a room of a place that books whole), cannot be
  // booked, so it is not priced either: the booking engine refuses both in the same way.
  if (!room?.active || room.kind !== BOOKABLE_ROOM_KIND[place.bookingUnit]) throw notFound("Room");

  const nightCount = countNights(range);
  const issue = stayIssue({ range, guests, room }, now);
  const quote = nightCount > MAX_STAY_NIGHTS ? { nights: [], totalCents: 0 } : await priceStay(room, range);
  return { roomId: room.id, currency: place.currency, nightCount, issue, ...quote };
}

/**
 * A place's page, by its link: what any visitor may see, or null when there is no such place (or it is paused or
 * deleted). It books by its rooms or as a whole; either way `units` is what a guest can book, and a place booked
 * whole also lists its rooms, to show. A place with no photos of its own shows its rooms' photos, so a host who only
 * photographed the rooms still has a gallery.
 */
export async function getPlace(slug: string, now: Date = new Date()): Promise<PublicPlace | null> {
  const place = await getPublicPlace(slug);
  if (!place) return null;
  const whole = place.bookingUnit === "WHOLE_PLACE";
  const [units, placePhotos, rooms, host, rating, reviews] = await Promise.all([
    listPublicUnits(place.id, BOOKABLE_ROOM_KIND[place.bookingUnit]),
    listPlacePhotos(place.id),
    whole ? listPublicUnits(place.id, "ROOM") : null,
    getPublicHost(place.id, now),
    getPlaceRating(place.id),
    listPlaceReviews(place.id),
  ]);
  return {
    slug: place.slug,
    name: place.name,
    description: place.description,
    area: place.area,
    currency: place.currency,
    checkInTime: place.checkInTime,
    checkOutTime: place.checkOutTime,
    holdHours: place.holdHours,
    houseRules: place.houseRules,
    bookingUnit: place.bookingUnit,
    bookingMode: place.bookingMode,
    whatsapp: place.whatsapp,
    latitude: place.latitude,
    longitude: place.longitude,
    host,
    rating,
    reviews,
    photos: placePhotos.length > 0 ? placePhotos : (rooms ?? units).flatMap((unit) => unit.photos),
    units,
    rooms: rooms ?? units,
  };
}

/**
 * A place's host as guests meet them: how to reach them, their profile if they show it, and how they answered
 * requests over the past year. The answer figures are only given with enough requests to mean something.
 */
async function getPublicHost(businessId: string, now: Date): Promise<PublicHost> {
  const [section, stats] = await Promise.all([
    getHostSection(businessId),
    getResponseStats(businessId, addDays(now, -RESPONSE_WINDOW_DAYS)),
  ]);
  return {
    ...section,
    response:
      stats.requests < MIN_REQUESTS_FOR_RESPONSE
        ? null
        : { rate: stats.answered / stats.requests, medianMinutes: stats.medianMinutes },
  };
}

/**
 * The nights a guest cannot book in a room, for its calendar: confirmed stays, held rooms, platform stays and closed
 * dates, as dates only. Asked of the same room a quote is (a room the place does not book by is not found).
 */
export async function getRoomAvailability(
  slug: string,
  roomId: string,
  range: DateRange,
  now: Date = new Date(),
): Promise<RoomAvailability> {
  const place = await findBookablePlace(slug);
  if (!place) throw notFound("Place");
  const room = await findRoomForBooking(place.id, roomId);
  if (!room?.active || room.kind !== BOOKABLE_ROOM_KIND[place.bookingUnit]) throw notFound("Room");
  return { roomId: room.id, takenNights: await getTakenNights(place.id, room.id, range, now) };
}

/** The signed-in guest's stays, newest first, as the trips list shows them. */
export async function listMyTrips(guestUserId: string, now: Date = new Date()): Promise<GuestTrip[]> {
  const bookings = await listMyBookings(guestUserId);
  const over = bookings.filter(
    (booking) => booking.status === "CONFIRMED" && toIsoDate(booking.checkOut) <= toIsoDate(todayUtc(now)),
  );
  const reviewed = await findReviewedBookings(over.map((booking) => booking.id));
  return bookings.map((booking) => ({
    publicToken: booking.publicToken,
    reference: booking.reference,
    status: booking.status,
    bookingMode: booking.bookingMode,
    checkIn: toIsoDate(booking.checkIn),
    checkOut: toIsoDate(booking.checkOut),
    guestCount: booking.guestCount,
    totalCents: booking.totalCents,
    currency: booking.currency,
    place: { name: booking.business.name, slug: booking.business.slug },
    roomName: booking.room.name,
    canReview: over.includes(booking) && !reviewed.has(booking.id),
  }));
}

/** Most places a search reads before it checks their rooms, for each card it may show. */
const PLACES_READ_PER_RESULT = 3;
/** Most rooms one availability read takes (`findFreeRooms`). */
const ROOMS_PER_READ = 500;

/** The rooms of `roomIds` free on every night of `range`, in reads of at most `ROOMS_PER_READ`. */
async function freeRoomsAmong(roomIds: string[], range: DateRange, now: Date): Promise<Set<string>> {
  const reads = [];
  for (let start = 0; start < roomIds.length; start += ROOMS_PER_READ) {
    reads.push(findFreeRooms(roomIds.slice(start, start + ROOMS_PER_READ), range, now));
  }
  return new Set((await Promise.all(reads)).flat());
}

const cheapest = (values: number[]) => Math.min(...values);

/** A place as the card reads come back: search's and a guest's saved places give the same fields. */
type PlaceRow = Awaited<ReturnType<typeof listPlacesByIds>>[number];
type SearchUnit = Awaited<ReturnType<typeof findSearchUnits>>[number];

/**
 * Listed places that have a unit fitting the search, cheapest night first within each place. Without dates every
 * fitting unit counts, at its base price. With dates a unit counts only when the booking engine would take the stay
 * (`stayIssue`: not past, not too far, its minimum nights, its guests) and it is free on every night, priced night
 * by night. A few queries however many places: the places, their units and covers, then the free rooms and prices.
 * The website, the guest's AI and the guest MCP all call this, so they always agree.
 */
export async function searchPlaces(search: PlaceSearch, now: Date = new Date()): Promise<PlaceCard[]> {
  const places = await listListedPlaces(search, search.limit * PLACES_READ_PER_RESULT);
  const [units, covers] = await Promise.all([
    findSearchUnits(
      places.map((place) => ({ businessId: place.id, kind: BOOKABLE_ROOM_KIND[place.bookingUnit] })),
      search,
    ),
    findPlaceCovers(places.map((place) => place.id)),
  ]);

  const { range } = search;
  let fitting = units;
  let prices = new Map<string, { nights: { rateCents: number }[]; totalCents: number }>();
  if (range) {
    const bookable = units.filter(
      (unit) => stayIssue({ range, guests: search.guests, room: unit }, now) === null,
    );
    const [free, quotes] = await Promise.all([
      freeRoomsAmong(
        bookable.map((unit) => unit.id),
        range,
        now,
      ),
      priceStays(bookable, range),
    ]);
    fitting = bookable.filter((unit) => free.has(unit.id));
    prices = quotes;
  }

  return buildCards(places, fitting, covers, prices, search.limit);
}

/**
 * The cards for places whose units are already known: its cheapest unit sets the price, and its own first photo
 * the picture, falling back to a unit's. A place with no unit left after the filters is not a result at all.
 * `prices` is empty without dates, and then a card shows a night's price instead of a stay's.
 */
function buildCards(
  places: ReadonlyArray<PlaceRow>,
  units: ReadonlyArray<SearchUnit>,
  covers: ReadonlyMap<string, PublicPhoto>,
  prices: ReadonlyMap<string, { nights: { rateCents: number }[]; totalCents: number }>,
  limit: number,
): PlaceCard[] {
  const cards: PlaceCard[] = [];
  for (const place of places) {
    const placeUnits = units.filter((unit) => unit.businessId === place.id);
    if (placeUnits.length === 0) continue;
    const offers: SearchOffer[] = placeUnits.map((unit) => {
      const quote = prices.get(unit.id);
      return {
        roomId: unit.id,
        name: unit.name,
        capacity: unit.capacity,
        bedrooms: unit.bedrooms,
        beds: unit.beds,
        bathrooms: unit.bathrooms,
        amenities: unit.amenities,
        nightlyFromCents: quote ? cheapest(quote.nights.map((night) => night.rateCents)) : unit.baseRateCents,
        stayTotalCents: quote ? quote.totalCents : null,
      };
    });
    offers.sort((first, second) => first.nightlyFromCents - second.nightlyFromCents);
    const totals = offers.flatMap((offer) => (offer.stayTotalCents === null ? [] : [offer.stayTotalCents]));
    cards.push({
      slug: place.slug,
      name: place.name,
      area: place.area,
      currency: place.currency,
      photo: covers.get(place.id) ?? placeUnits.find((unit) => unit.photos.length > 0)?.photos[0] ?? null,
      categories: place.categories,
      nightlyFromCents: cheapest(offers.map((offer) => offer.nightlyFromCents)),
      stayTotalFromCents: totals.length > 0 ? cheapest(totals) : null,
      offers,
    });
    if (cards.length === limit) break;
  }
  return cards;
}

/**
 * The cards of the places a guest saved, newest first, with a night's price and no stay in mind. A place saved
 * before its owner paused it simply drops off the list.
 */
export async function listSavedPlaces(businessIds: readonly string[]): Promise<PlaceCard[]> {
  if (businessIds.length === 0) return [];
  const places = await listPlacesByIds(businessIds);
  const [units, covers] = await Promise.all([
    findSearchUnits(
      places.map((place) => ({ businessId: place.id, kind: BOOKABLE_ROOM_KIND[place.bookingUnit] })),
      // Saved places are shown as they are, for nobody in particular: every unit counts, at its own price.
      { guests: 1 },
    ),
    findPlaceCovers(places.map((place) => place.id)),
  ]);
  const order = new Map(businessIds.map((id, position) => [id, position]));
  const saved = [...places].sort((first, second) => (order.get(first.id) ?? 0) - (order.get(second.id) ?? 0));
  return buildCards(saved, units, covers, new Map(), saved.length);
}

/**
 * Whether a place can be had for a stay: each unit it is booked by, free or not on every night, whether the stay fits
 * it (`stayIssue`, the booking engine's own rule) and its price. Two reads however many units. Unknown, paused or
 * deleted places are not found, like their page.
 */
export async function checkPlaceAvailability(
  slug: string,
  { range, guests }: { range: DateRange; guests: number | null },
  now: Date = new Date(),
): Promise<PlaceAvailability> {
  const place = await getPlace(slug);
  if (!place) throw notFound("Place");
  const nightCount = countNights(range);
  const [free, prices] = await Promise.all([
    freeRoomsAmong(
      place.units.map((unit) => unit.id),
      range,
      now,
    ),
    nightCount > MAX_STAY_NIGHTS
      ? new Map<string, { totalCents: number }>()
      : priceStays(
          place.units.map((unit) => ({ id: unit.id, baseRateCents: unit.baseRateCents })),
          range,
        ),
  ]);
  return {
    slug: place.slug,
    name: place.name,
    currency: place.currency,
    nightCount,
    units: place.units.map((unit) => ({
      roomId: unit.id,
      name: unit.name,
      capacity: unit.capacity,
      free: free.has(unit.id),
      issue: stayIssue({ range, guests, room: unit }, now),
      totalCents: prices.get(unit.id)?.totalCents ?? null,
    })),
  };
}
