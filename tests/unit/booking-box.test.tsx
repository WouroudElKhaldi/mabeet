import { NextIntlClientProvider } from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ar from "../../messages/ar.json";
import en from "../../messages/en.json";
import { BookingBox } from "@/modules/directory/components/booking-box";
import type { PublicUnit } from "@/modules/directory/types";

// The booking box as a guest first sees it, before any date is picked. Choosing dates and the price that comes back
// were checked in a browser; the rules behind them are tested in src/modules/directory/tests/quote-rules.test.ts and tests/unit/stay-selection.test.ts.

const unit = (id: string, overrides: Partial<PublicUnit> = {}): PublicUnit => ({
  id,
  name: `Room ${id}`,
  description: null,
  capacity: 3,
  bedrooms: 1,
  beds: 2,
  bathrooms: 1,
  baseRateCents: 9_500,
  minNights: 1,
  amenities: [],
  photos: [],
  ...overrides,
});

function render(props: Partial<Parameters<typeof BookingBox>[0]> & { locale?: "en" | "ar" } = {}) {
  const { locale = "en", ...rest } = props;
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={locale === "en" ? en : ar}>
      <BookingBox
        place={{ slug: "beit-cedar", currency: "USD", bookingMode: "ONLINE_APPROVAL" }}
        units={[unit("a"), unit("b")]}
        {...rest}
      />
    </NextIntlClientProvider>,
  );
}

describe("BookingBox", () => {
  it("shows the first room's price, the picker, the counter and a disabled button until dates are picked", () => {
    const html = render();
    expect(html).toContain("$95.00");
    expect(html).toContain("Add date");
    expect(html).toContain("Fewer guests");
    expect(html).toMatch(/Pick your dates<\/button>/);
    expect(html).toMatch(/<button[^>]*aria-disabled="true"[^>]*>Pick your dates/);
    expect(html).not.toContain("Total");
  });

  it("offers a room choice only when there is more than one room", () => {
    expect(render()).toContain("<select");
    expect(render({ units: [unit("a")] })).not.toContain("<select");
  });

  it("says in one line how this place works, whatever its mode", () => {
    expect(render({ place: { slug: "x", currency: "USD", bookingMode: "AUTOMATIC" } })).toContain(
      "Pay online, confirmed at once",
    );
    expect(render({ place: { slug: "x", currency: "USD", bookingMode: "OFFLINE" } })).toContain(
      "Arrange payment with the host",
    );
  });

  it("starts on the room a link asked for, and on the first room when the link names one that is not here", () => {
    const rooms = [unit("a"), unit("b", { baseRateCents: 12_000 })];
    expect(render({ units: rooms, initial: { roomId: "b" } })).toContain("$120.00");
    expect(render({ units: rooms, initial: { roomId: "ghost" } })).toContain("$95.00");
  });

  it("shows dates carried over from a link, and does not break on dates that are not dates", () => {
    expect(render({ initial: { checkIn: "2026-11-14", checkOut: "2026-11-17" } })).toContain("Sat, Nov 14");
    expect(() => render({ initial: { checkIn: "soon", checkOut: "never" } })).not.toThrow();
  });

  it("shows no more guests than the room sleeps, even when the link asked for more", () => {
    expect(render({ units: [unit("a", { capacity: 2 })], initial: { guests: 9 } })).toContain("2 guests");
  });

  it("writes the price in Arabic with Latin digits", () => {
    const html = render({ locale: "ar" });
    expect(html).toContain("95.00");
    expect(html).not.toMatch(/[٠-٩]/);
  });

  it("renders nothing when there is nothing to book", () => {
    expect(render({ units: [] })).toBe("");
  });
});
