import { describe, expect, it } from "vitest";
import { splitTrips } from "../trips";
import type { GuestTrip } from "../types";

const trip = (token: string, overrides: Partial<GuestTrip> = {}): GuestTrip => ({
  publicToken: token,
  reference: `MB-${token}`,
  status: "CONFIRMED",
  bookingMode: "OFFLINE",
  checkIn: "2026-11-20",
  checkOut: "2026-11-22",
  guestCount: 2,
  totalCents: 19_000,
  currency: "USD",
  place: { name: "Beit el Arz", slug: "beit-el-arz" },
  roomName: "Cedar room",
  canReview: false,
  ...overrides,
});

const today = "2026-11-14";
const tokens = (trips: GuestTrip[]) => trips.map((item) => item.publicToken);

describe("splitTrips", () => {
  it("puts a live booking that is not over under upcoming, soonest first", () => {
    const later = trip("later", { checkIn: "2026-12-10", checkOut: "2026-12-12" });
    const sooner = trip("sooner", { checkIn: "2026-11-18", checkOut: "2026-11-19", status: "HELD" });
    const paying = trip("paying", {
      checkIn: "2026-11-25",
      checkOut: "2026-11-27",
      status: "AWAITING_PAYMENT",
    });
    const { upcoming, past } = splitTrips([later, sooner, paying], today);
    expect(tokens(upcoming)).toEqual(["sooner", "paying", "later"]);
    expect(past).toEqual([]);
  });

  it("puts every booking that ended under past, newest first, whatever its dates", () => {
    const declined = trip("declined", { status: "DECLINED", checkIn: "2026-12-01", checkOut: "2026-12-03" });
    const expired = trip("expired", { status: "EXPIRED", checkIn: "2026-11-30", checkOut: "2026-12-01" });
    const cancelled = trip("cancelled", {
      status: "CANCELLED",
      checkIn: "2026-12-20",
      checkOut: "2026-12-22",
    });
    const { upcoming, past } = splitTrips([expired, declined, cancelled], today);
    expect(upcoming).toEqual([]);
    expect(tokens(past)).toEqual(["cancelled", "declined", "expired"]);
  });

  it("counts a stay as over on its check-out day, and as under way the day before", () => {
    const leavesToday = trip("leaves-today", { checkIn: "2026-11-12", checkOut: today });
    const leavesTomorrow = trip("leaves-tomorrow", { checkIn: "2026-11-12", checkOut: "2026-11-15" });
    const { upcoming, past } = splitTrips([leavesToday, leavesTomorrow], today);
    expect(tokens(upcoming)).toEqual(["leaves-tomorrow"]);
    expect(tokens(past)).toEqual(["leaves-today"]);
  });

  it("shows a confirmed stay in the past once it is over", () => {
    const over = trip("over", { checkIn: "2026-10-01", checkOut: "2026-10-03" });
    expect(tokens(splitTrips([over], today).past)).toEqual(["over"]);
  });

  it("shows each stay once, and nothing for no stays", () => {
    const all = [
      trip("a"),
      trip("b", { status: "CANCELLED" }),
      trip("c", { checkIn: "2026-01-01", checkOut: "2026-01-02" }),
    ];
    const { upcoming, past } = splitTrips(all, today);
    expect([...tokens(upcoming), ...tokens(past)].sort()).toEqual(["a", "b", "c"]);
    expect(splitTrips([], today)).toEqual({ upcoming: [], past: [] });
  });

  it("leaves the list it was given as it was", () => {
    const given = [trip("z", { checkIn: "2026-12-30", checkOut: "2026-12-31" }), trip("y")];
    const copy = [...given];
    splitTrips(given, today);
    expect(given).toEqual(copy);
  });
});
