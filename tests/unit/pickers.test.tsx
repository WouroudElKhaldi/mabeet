import { NextIntlClientProvider } from "next-intl";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ar from "../../messages/ar.json";
import en from "../../messages/en.json";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { GuestCounter } from "@/components/ui/guest-counter";
import { clampGuests } from "@/utils/guest-count";

// The pickers as a screen reader and a first paint see them (a closed dialog, nothing clicked). Choosing days is
// covered by tests/unit/stay-selection.test.ts and calendar-grid.test.ts; clicking and typing were checked in a browser.

function render(element: ReactElement, locale: "en" | "ar" = "en") {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={locale === "en" ? en : ar}>
      {element}
    </NextIntlClientProvider>,
  );
}

describe("clampGuests", () => {
  it("keeps a good number and pulls a bad one into range", () => {
    expect(clampGuests(3, 1, 6)).toBe(3);
    expect(clampGuests(0, 1, 6)).toBe(1);
    expect(clampGuests(-4, 1, 6)).toBe(1);
    expect(clampGuests(9, 1, 6)).toBe(6);
  });

  it("makes a whole number out of a fraction, and a minimum out of a missing value", () => {
    expect(clampGuests(2.9, 1, 6)).toBe(2);
    expect(clampGuests(Number.NaN, 1, 6)).toBe(1);
    expect(clampGuests(Number.POSITIVE_INFINITY, 1, 6)).toBe(1);
  });

  it("never returns less than the minimum when the maximum is smaller than it", () => {
    expect(clampGuests(5, 2, 0)).toBe(2);
  });
});

describe("GuestCounter", () => {
  const props = { onChange: () => {}, max: 4 };

  it("shows the number, a name for the group, and what the buttons do", () => {
    const html = render(<GuestCounter {...props} value={2} />);
    expect(html).toContain('role="group"');
    expect(html).toContain("Guests");
    expect(html).toContain('aria-label="Fewer guests"');
    expect(html).toContain('aria-label="More guests"');
    expect(html).toContain("2 guests");
  });

  it("reads the count in the Arabic plural form", () => {
    expect(render(<GuestCounter {...props} value={2} />, "ar")).toContain("ضيفان");
  });

  it("marks the button at a limit, without disabling it", () => {
    const atMin = render(<GuestCounter {...props} value={1} />);
    expect(atMin).toMatch(/aria-label="Fewer guests"[^>]*aria-disabled="true"/);
    expect(atMin).toMatch(/aria-label="More guests"[^>]*aria-disabled="false"/);
    expect(atMin).not.toMatch(/<button[^>]*\sdisabled[=\s>]/);
    const atMax = render(<GuestCounter {...props} value={4} />);
    expect(atMax).toMatch(/aria-label="More guests"[^>]*aria-disabled="true"/);
  });

  it("shows the nearest number that fits when the value does not", () => {
    expect(render(<GuestCounter {...props} value={9} />)).toContain("4 guests");
    expect(render(<GuestCounter {...props} value={0} />)).toContain("1 guest");
  });

  it("shows the hint under the label", () => {
    expect(render(<GuestCounter {...props} value={2} hint="Including children" />)).toContain(
      "Including children",
    );
  });
});

describe("DateRangePicker (closed)", () => {
  const noDates = { checkIn: null, checkOut: null };

  it("shows two labelled cells with a prompt when there are no dates", () => {
    const html = render(<DateRangePicker value={noDates} onChange={() => {}} />);
    expect(html).toContain("Check-in");
    expect(html).toContain("Check-out");
    expect(html.match(/Add date/g)).toHaveLength(2);
    expect(html).toContain('aria-haspopup="dialog"');
  });

  it("shows the chosen days, read in UTC so no zone moves them", () => {
    const html = render(
      <DateRangePicker value={{ checkIn: "2026-11-14", checkOut: "2026-11-17" }} onChange={() => {}} />,
    );
    expect(html).toContain("Sat, Nov 14");
    expect(html).toContain("Tue, Nov 17");
    expect(html).not.toContain("Add date");
  });

  it("shows only the check-in while the check-out is still to choose", () => {
    const html = render(
      <DateRangePicker value={{ checkIn: "2026-11-14", checkOut: null }} onChange={() => {}} />,
    );
    expect(html).toContain("Sat, Nov 14");
    expect(html.match(/Add date/g)).toHaveLength(1);
  });

  it("does not break on dates that are not dates, or a stay back to front", () => {
    expect(() =>
      render(<DateRangePicker value={{ checkIn: "soon", checkOut: "2026-02-31" }} onChange={() => {}} />),
    ).not.toThrow();
    const html = render(
      <DateRangePicker value={{ checkIn: "2026-11-17", checkOut: "2026-11-14" }} onChange={() => {}} />,
    );
    expect(html).toContain("Tue, Nov 17");
    expect(html.match(/Add date/g)).toHaveLength(1);
  });

  it("passes the error state and the link to its message on to the button", () => {
    const html = render(
      <DateRangePicker
        value={noDates}
        onChange={() => {}}
        aria-invalid
        aria-describedby="why"
        id="stay-dates"
      />,
    );
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('aria-describedby="why"');
    expect(html).toContain('id="stay-dates"');
  });

  it("writes the dates in Arabic month names with Latin digits", () => {
    const html = render(
      <DateRangePicker value={{ checkIn: "2026-11-14", checkOut: "2026-11-17" }} onChange={() => {}} />,
      "ar",
    );
    expect(html).toContain("14");
    expect(html).toMatch(/نوفمبر|تشرين/);
    expect(html).not.toMatch(/[٠-٩]/);
  });
});
