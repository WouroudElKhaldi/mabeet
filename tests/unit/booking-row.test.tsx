import { NextIntlClientProvider } from "next-intl";
import type { ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import ar from "../../messages/ar.json";
import en from "../../messages/en.json";
import { BookingRow } from "@/modules/bookings";

// The host's booking row as a first paint sees it: which answers it offers, and how long a waiting booking has left.
// Pressing an answer is the decision route's job, covered in host-routes.integration.test.ts.

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const now = new Date("2026-11-10T09:00:00Z");

type Booking = ComponentProps<typeof BookingRow>["booking"];

const held: Booking = {
  id: "bk1",
  reference: "MB-7Q2K",
  guestName: "Rami Haddad",
  guestCount: 2,
  checkIn: new Date("2026-11-20T00:00:00Z"),
  checkOut: new Date("2026-11-23T00:00:00Z"),
  totalCents: 36_000,
  currency: "USD",
  status: "HELD",
  holdExpiresAt: new Date("2026-11-10T21:00:00Z"),
  room: { name: "Cedar room" },
};

function render(
  booking: Booking,
  { canDecide = true, locale = "en" }: { canDecide?: boolean; locale?: "en" | "ar" } = {},
) {
  // The markup escapes apostrophes; the texts are compared as the host reads them.
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={locale === "en" ? en : ar} timeZone="Asia/Beirut">
      <BookingRow booking={booking} businessId="b1" canDecide={canDecide} now={now} />
    </NextIntlClientProvider>,
  ).replaceAll("&#x27;", "'");
}

const buttonLabels = (html: string) =>
  [...html.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/g)].map((match) =>
    (match[1] ?? "").replace(/<[^>]+>/g, "").trim(),
  );

describe("BookingRow", () => {
  it("shows the guest, room, dates, total and status of the stay", () => {
    const html = render(held);
    expect(html).toContain("Rami Haddad");
    expect(html).toContain("Cedar room");
    expect(html).toContain("$360.00");
    expect(html).toContain(en.dashboard.bookings.status.HELD);
    expect(html).toContain("MB-7Q2K");
  });

  it("offers Confirm and Decline on a request waiting for the host, with the time left to answer", () => {
    const html = render(held);
    expect(buttonLabels(html)).toEqual([en.dashboard.bookings.confirm, en.dashboard.bookings.decline]);
    expect(html).toContain("Answer in 12 hours");
  });

  it("offers Cancel on a confirmed stay that has not started", () => {
    expect(buttonLabels(render({ ...held, status: "CONFIRMED", holdExpiresAt: null }))).toEqual([
      en.dashboard.bookings.cancel,
    ]);
  });

  it("offers nothing on a stay that has started, or that already ended", () => {
    const started: Booking = { ...held, status: "CONFIRMED", checkIn: new Date("2026-11-10T00:00:00Z") };
    expect(buttonLabels(render(started))).toEqual([]);
    expect(buttonLabels(render({ ...held, status: "DECLINED" }))).toEqual([]);
  });

  it("leaves the online payment to the guest: no answer while it waits, only the time they have left", () => {
    const awaiting: Booking = {
      ...held,
      status: "AWAITING_PAYMENT",
      holdExpiresAt: new Date("2026-11-10T09:08:00Z"),
    };
    const html = render(awaiting);
    expect(buttonLabels(html)).toEqual([]);
    expect(html).toContain("Guest pays in 8 minutes");
  });

  it("says when the time ran out, before housekeeping ends the booking", () => {
    expect(render({ ...held, holdExpiresAt: new Date("2026-11-10T08:59:00Z") })).toContain(
      en.dashboard.bookings.timeUp,
    );
  });

  it("shows no answers to a member who may only read bookings", () => {
    expect(buttonLabels(render(held, { canDecide: false }))).toEqual([]);
  });

  it("speaks the host's language", () => {
    const html = render(held, { locale: "ar" });
    expect(buttonLabels(html)).toEqual([ar.dashboard.bookings.confirm, ar.dashboard.bookings.decline]);
    expect(html).toContain(ar.dashboard.bookings.status.HELD);
  });
});
