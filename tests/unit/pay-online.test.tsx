import { NextIntlClientProvider } from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import ar from "../../messages/ar.json";
import en from "../../messages/en.json";
import type { OnlinePaymentMethod } from "@/config/enums";
import { PayOnline } from "@/modules/payments";

// The guest's pay buttons as a first paint sees them. Pressing one is the checkout route's job, covered with the real
// payment flow in booking-payments.integration.test.ts.

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

function render(methods: OnlinePaymentMethod[], locale: "en" | "ar" = "en") {
  // The markup escapes apostrophes; the texts are compared as the guest reads them.
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={locale === "en" ? en : ar} timeZone="Asia/Beirut">
      <PayOnline token="booking-token" methods={methods} />
    </NextIntlClientProvider>,
  ).replaceAll("&#x27;", "'");
}

const buttonLabels = (html: string) =>
  [...html.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/g)].map((match) =>
    (match[1] ?? "").replace(/<[^>]+>/g, "").trim(),
  );

describe("PayOnline", () => {
  it("offers one button per way to pay, Whish first, and none disabled", () => {
    const html = render(["WHISH", "CARD"]);
    expect(buttonLabels(html)).toEqual([en.confirmation.pay.whish, en.confirmation.pay.card]);
    expect(html).not.toMatch(/<button[^>]* disabled=/);
  });

  it("offers only the ways this booking's currency can be paid", () => {
    expect(buttonLabels(render(["CARD"]))).toEqual([en.confirmation.pay.card]);
  });

  it("says to message the host, with no button, when no way to pay is open", () => {
    const html = render([]);
    expect(buttonLabels(html)).toEqual([]);
    expect(html).toContain(en.confirmation.pay.unavailable);
  });

  it("speaks the guest's language", () => {
    expect(buttonLabels(render(["WHISH", "CARD"], "ar"))).toEqual([
      ar.confirmation.pay.whish,
      ar.confirmation.pay.card,
    ]);
  });
});
