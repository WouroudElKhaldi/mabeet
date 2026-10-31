import { BookingMode, BookingStatus, FeedSource, PhotoArea } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  ACTIVE_BOOKING_STATUSES,
  BOOKING_MODES,
  BOOKING_STATUSES,
  EXPIRING_BOOKING_STATUSES,
  FEED_SOURCES,
  isActiveBooking,
  isOnlineMode,
  ONLINE_BOOKING_MODES,
  PHOTO_AREAS,
} from "@/config/enums";

// `satisfies` only proves every listed value exists in the database; these prove no database value is missing.
const sorted = (values: readonly string[]) => [...values].sort();

describe("value lists", () => {
  it("cover every value the database allows", () => {
    expect(sorted(BOOKING_STATUSES)).toEqual(sorted(Object.values(BookingStatus)));
    expect(sorted(BOOKING_MODES)).toEqual(sorted(Object.values(BookingMode)));
    expect(sorted(FEED_SOURCES)).toEqual(sorted(Object.values(FeedSource)));
    expect(sorted(PHOTO_AREAS)).toEqual(sorted(Object.values(PhotoArea)));
  });

  it("count a waiting, unpaid or confirmed booking as holding its nights, and nothing else", () => {
    expect(ACTIVE_BOOKING_STATUSES).toEqual(["HELD", "AWAITING_PAYMENT", "CONFIRMED"]);
    expect(BOOKING_STATUSES.filter(isActiveBooking)).toEqual([...ACTIVE_BOOKING_STATUSES]);
    expect(EXPIRING_BOOKING_STATUSES.every(isActiveBooking)).toBe(true);
  });

  it("treat only automatic and online-with-approval as paid online", () => {
    expect(ONLINE_BOOKING_MODES).toEqual(["AUTOMATIC", "ONLINE_APPROVAL"]);
    expect(BOOKING_MODES.filter(isOnlineMode)).toEqual([...ONLINE_BOOKING_MODES]);
  });
});
