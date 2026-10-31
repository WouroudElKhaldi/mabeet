import { describe, expect, it } from "vitest";
import { escapeHtml, render } from "@/server/email/templates";

describe("email templates", () => {
  it("escapes text that guests wrote, so a name cannot inject HTML", () => {
    const email = render("Hello", {
      kicker: "Booking request",
      title: `<script>alert("x")</script>`,
      body: [`Note: <img src=x onerror=alert(1)>`],
      details: [{ label: "Guest", value: `O'Brien & <b>sons</b>` }],
    });
    expect(email.html).not.toContain("<script>");
    expect(email.html).not.toContain("<img");
    expect(email.html).toContain("&lt;script&gt;");
    expect(email.html).toContain("O&#39;Brien &amp; &lt;b&gt;sons&lt;/b&gt;");
  });

  it("has a plain-text version with the link and the details", () => {
    const email = render("Confirmed", {
      kicker: "Confirmed",
      title: "You're going",
      body: ["See you soon."],
      details: [{ label: "Reference", value: "MB-ABC234" }],
      action: { label: "See your booking", url: "https://example.com/b/token" },
    });
    expect(email.subject).toBe("Confirmed");
    expect(email.text).toContain("Reference: MB-ABC234");
    expect(email.text).toContain("See your booking: https://example.com/b/token");
  });

  it("lays Arabic out right to left, without capitals or letter spacing", () => {
    const email = render(
      "تم التأكيد",
      { kicker: "تم التأكيد", title: "أنت ذاهب!", body: ["نراك قريبًا."] },
      "ar",
    );
    expect(email.html).toContain(`<html lang="ar" dir="rtl">`);
    expect(email.html).toContain("text-align:right");
    expect(email.html).not.toContain("text-transform:uppercase");
    expect(render("Hi", { kicker: "K", title: "T", body: [] }).html).toContain(`dir="ltr"`);
  });

  it("escapes every HTML-special character", () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
  });
});
