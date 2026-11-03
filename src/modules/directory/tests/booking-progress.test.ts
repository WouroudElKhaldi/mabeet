import { describe, expect, it } from "vitest";
import { bookingProgress, canGuestCancel, watchEverySeconds } from "../booking-progress";

describe("bookingProgress", () => {
  it("online and confirmed at once: sent, then paid; the guest is on the payment until it lands", () => {
    expect(bookingProgress("AUTOMATIC", "AWAITING_PAYMENT")).toEqual({
      steps: ["requested", "paid"],
      current: 1,
    });
    expect(bookingProgress("AUTOMATIC", "CONFIRMED")).toEqual({ steps: ["requested", "paid"], current: 1 });
  });

  it("online and confirmed by the host: on the payment, then on the host's answer", () => {
    const steps = ["requested", "paid", "confirmed"];
    expect(bookingProgress("ONLINE_APPROVAL", "AWAITING_PAYMENT")).toEqual({ steps, current: 1 });
    expect(bookingProgress("ONLINE_APPROVAL", "HELD")).toEqual({ steps, current: 2 });
    expect(bookingProgress("ONLINE_APPROVAL", "CONFIRMED")).toEqual({ steps, current: 2 });
  });

  it("offline: sent, then the host's answer, with no payment step", () => {
    const expected = { steps: ["requested", "confirmed"], current: 1 };
    expect(bookingProgress("OFFLINE", "HELD")).toEqual(expected);
    expect(bookingProgress("OFFLINE", "CONFIRMED")).toEqual(expected);
  });

  it("has no steps left for a booking that ended, in any mode", () => {
    for (const mode of ["AUTOMATIC", "ONLINE_APPROVAL", "OFFLINE"] as const) {
      for (const status of ["DECLINED", "EXPIRED", "CANCELLED"] as const) {
        expect(bookingProgress(mode, status), `${mode} ${status}`).toBeNull();
      }
    }
  });
});

describe("canGuestCancel", () => {
  it("allows a waiting or confirmed booking before the check-in day", () => {
    for (const status of ["HELD", "AWAITING_PAYMENT", "CONFIRMED"] as const) {
      expect(canGuestCancel(status, "2026-11-20", "2026-11-14"), status).toBe(true);
    }
  });

  it("refuses on the check-in day and after, like the booking engine", () => {
    expect(canGuestCancel("CONFIRMED", "2026-11-14", "2026-11-14")).toBe(false);
    expect(canGuestCancel("CONFIRMED", "2026-11-13", "2026-11-14")).toBe(false);
    expect(canGuestCancel("CONFIRMED", "2026-11-15", "2026-11-14")).toBe(true);
  });

  it("refuses a booking that already ended", () => {
    for (const status of ["DECLINED", "EXPIRED", "CANCELLED"] as const) {
      expect(canGuestCancel(status, "2026-12-01", "2026-11-14"), status).toBe(false);
    }
  });
});

describe("watchEverySeconds", () => {
  it("looks often while the guest pays, less often while the host decides, and stops once nothing can change", () => {
    expect(watchEverySeconds("AUTOMATIC", "AWAITING_PAYMENT")).toBe(4);
    expect(watchEverySeconds("ONLINE_APPROVAL", "HELD")).toBe(15);
    expect(watchEverySeconds("OFFLINE", "HELD")).toBe(30);
    for (const status of ["CONFIRMED", "DECLINED", "EXPIRED", "CANCELLED"] as const) {
      expect(watchEverySeconds("OFFLINE", status), status).toBeNull();
    }
  });
});
