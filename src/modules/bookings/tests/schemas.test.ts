import { describe, expect, it } from "vitest";
import {
  blockInput,
  blockParams,
  bookingActionParams,
  bookingFilters,
  bookingParams,
  bookingRequestInput,
  bookingTokenParams,
  calendarQuery,
  decisionInput,
  guestCancelInput,
  placeParams,
} from "..";

const request = {
  roomId: "room_1",
  guestCount: 2,
  guestName: "  Maya Haddad ",
  guestPhone: "+96171123456",
  checkIn: "2026-12-10",
  checkOut: "2026-12-12",
};

const night = (date: string) => new Date(`${date}T00:00:00.000Z`);

describe("booking input checks", () => {
  it("hands the service the nights as a range, and missing text as null", () => {
    expect(bookingRequestInput.parse(request)).toEqual({
      roomId: "room_1",
      guestCount: 2,
      guestName: "Maya Haddad",
      guestPhone: "+96171123456",
      guestEmail: null,
      guestNote: null,
      range: { checkIn: night("2026-12-10"), checkOut: night("2026-12-12") },
    });
  });

  it("refuses a check-out before check-in, a local phone number, too many guests and a wrong email", () => {
    expect(bookingRequestInput.safeParse({ ...request, checkOut: "2026-12-09" }).success).toBe(false);
    expect(bookingRequestInput.safeParse({ ...request, guestPhone: "71123456" }).success).toBe(false);
    expect(bookingRequestInput.safeParse({ ...request, guestCount: 31 }).success).toBe(false);
    expect(bookingRequestInput.safeParse({ ...request, guestEmail: "not-an-email" }).success).toBe(false);
  });

  it("knows only the owner's three answers", () => {
    const params = { businessId: "b", bookingId: "k" };
    expect(bookingActionParams.parse({ ...params, action: "decline" }).action).toBe("decline");
    expect(bookingActionParams.safeParse({ ...params, action: "approve" }).success).toBe(false);
  });

  it("reads list filters from the query string, with a page of 50 by default", () => {
    expect(bookingFilters.parse({ status: "HELD", from: "2026-12-01", take: "10" })).toEqual({
      status: "HELD",
      from: night("2026-12-01"),
      take: 10,
      skip: 0,
    });
    expect(bookingFilters.parse({})).toEqual({ take: 50, skip: 0 });
    expect(bookingFilters.safeParse({ status: "PAID" }).success).toBe(false);
  });

  it("checks the route parts and the short bodies of the other booking routes", () => {
    expect(placeParams.parse({ slug: " beit-jabal " })).toEqual({ slug: "beit-jabal" });
    expect(bookingTokenParams.safeParse({ token: "short" }).success).toBe(false);
    expect(bookingParams.parse({ businessId: "b", bookingId: "k" })).toEqual({
      businessId: "b",
      bookingId: "k",
    });
    expect(blockParams.parse({ businessId: "b", blockId: "o" })).toEqual({ businessId: "b", blockId: "o" });
    expect(decisionInput.parse({ reason: " Closed that week " })).toEqual({ reason: "Closed that week" });
    expect(decisionInput.safeParse({ reason: "x".repeat(501) }).success).toBe(false);
    expect(guestCancelInput.parse({})).toEqual({});
    expect(guestCancelInput.safeParse({ reason: "x".repeat(301) }).success).toBe(false);
    expect(calendarQuery.parse({ from: "2026-12-01", roomId: "room_1" })).toEqual({
      from: night("2026-12-01"),
      roomId: "room_1",
    });
    expect(calendarQuery.safeParse({ from: "2026-02-30" }).success).toBe(false);
  });

  it("closes nights with an optional note, and no platform source", () => {
    expect(blockInput.parse({ roomId: "room_1", checkIn: "2026-12-10", checkOut: "2026-12-11" })).toEqual({
      roomId: "room_1",
      range: { checkIn: night("2026-12-10"), checkOut: night("2026-12-11") },
      note: null,
    });
  });
});
