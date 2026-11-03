import { NextIntlClientProvider } from "next-intl";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import ar from "../../messages/ar.json";
import en from "../../messages/en.json";
import { GuestCancelButton, HoldCountdown } from "@/modules/directory";

// The guest's booking page parts as they first draw: the count starts from what the server said, and the cancel button
// is there, in the guest's language, before anything is pressed.

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {}, push: () => {} }) }));

function render(element: ReactElement, locale: "en" | "ar" = "en") {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={locale === "en" ? en : ar}>
      {element}
    </NextIntlClientProvider>,
  );
}

describe("HoldCountdown", () => {
  it("shows minutes and seconds under an hour", () => {
    expect(render(<HoldCountdown remainingSeconds={581} />)).toContain("09:41");
    expect(render(<HoldCountdown remainingSeconds={59} />)).toContain("00:59");
  });

  it("shows hours and minutes over an hour", () => {
    expect(render(<HoldCountdown remainingSeconds={3 * 3600 + 25 * 60 + 9} />)).toContain("3h 25m");
  });

  it("says the hold has ended at zero, and never shows negative time", () => {
    expect(render(<HoldCountdown remainingSeconds={0} />)).toContain("The hold has ended");
    expect(render(<HoldCountdown remainingSeconds={-30} />)).toContain("The hold has ended");
  });

  it("is announced as a timer, and uses the Arabic words when the guest reads Arabic", () => {
    expect(render(<HoldCountdown remainingSeconds={120} />)).toContain('role="timer"');
    expect(render(<HoldCountdown remainingSeconds={0} />, "ar")).not.toContain("The hold has ended");
  });
});

describe("GuestCancelButton", () => {
  it("is a plain button, not yet asking anything", () => {
    const html = render(<GuestCancelButton token={"t".repeat(24)} online />);
    expect(html).toContain("Cancel this booking");
    expect(html).not.toContain("Cancel booking<");
    expect(html).not.toMatch(/<dialog[^>]*open/);
  });
});
