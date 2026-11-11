import { NextIntlClientProvider } from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import ar from "../../messages/ar.json";
import en from "../../messages/en.json";
import { ContactHostForm } from "@/modules/directory";
import { hostDisplayName } from "@/modules/directory/host";
import type { PublicPlace } from "@/modules/directory/types";

// The host a guest meets: what the page calls them, and the form that writes to them. Which buttons a host offers
// and how their figures read are tested in src/modules/directory/tests/host.test.ts; who gets the email is in
// contact-host.integration.test.ts.

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const place = (host: Partial<PublicPlace["host"]> = {}): Pick<PublicPlace, "name" | "host"> => ({
  name: "Beit Cedar",
  host: { contactBy: "BOTH", profile: null, response: null, ...host },
});

function renderForm(locale: "en" | "ar" = "en") {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={locale === "en" ? en : ar}>
      <ContactHostForm slug="beit-cedar" hostName="Rana" />
    </NextIntlClientProvider>,
  );
}

describe("what the page calls the host", () => {
  it("uses the name on a shown profile", () => {
    const profile = { name: "Rana", bio: null, city: null, languages: [], hostingSince: null };
    expect(hostDisplayName(place({ profile }))).toBe("Rana");
  });

  it("falls back to the place's name while the profile is hidden, so no greeting is empty", () => {
    expect(hostDisplayName(place())).toBe("Beit Cedar");
  });
});

describe("the Contact host form", () => {
  it("asks for a name, the email the host replies to, and the question", () => {
    const html = renderForm();
    expect(html).toContain("Your name");
    expect(html).toContain("The host replies here.");
    expect(html).toContain('type="email"');
    expect(html).toContain("<textarea");
    expect(html).toContain("Send message");
  });

  it("names the host in the placeholder, so the guest knows who reads it", () => {
    expect(renderForm()).toContain("Hi Rana, I&#x27;d like to know…");
  });

  it("is written in Arabic too", () => {
    const html = renderForm("ar");
    expect(html).toContain("اسمك");
    expect(html).toContain("أرسل الرسالة");
  });
});
