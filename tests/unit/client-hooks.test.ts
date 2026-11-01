import { describe, expect, it } from "vitest";
import { isSafeRedirect } from "@/hooks/use-redirect-action";
import { pickChoice } from "@/hooks/use-stored-choice";

describe("isSafeRedirect", () => {
  it("follows a page of this site and an https address, such as a payment page", () => {
    expect(isSafeRedirect("/b/abc123")).toBe(true);
    expect(isSafeRedirect("/whish-simulator?pay=1")).toBe(true);
    expect(isSafeRedirect("https://checkout.stripe.com/c/pay/cs_test_1")).toBe(true);
  });

  it("refuses anything that could take a visitor somewhere unexpected", () => {
    for (const url of [
      "//evil.example",
      "/\\evil.example",
      "javascript:alert(1)",
      "data:text/html,x",
      "http://insecure.example",
      "evil.example/path",
      "/ok\nhttps://evil.example",
      "",
    ]) {
      expect(isSafeRedirect(url), url).toBe(false);
    }
  });

  it("refuses a missing or wrong answer from the server", () => {
    expect(isSafeRedirect(undefined)).toBe(false);
    expect(isSafeRedirect(null)).toBe(false);
    expect(isSafeRedirect(42)).toBe(false);
  });
});

describe("pickChoice", () => {
  const views = ["month", "week"] as const;

  it("uses the saved choice when it is still allowed", () => {
    expect(pickChoice("week", views, "month")).toBe("week");
  });

  it("uses the fallback when nothing is saved, or the saved value is old, edited or wrong", () => {
    expect(pickChoice(null, views, "month")).toBe("month");
    expect(pickChoice("year", views, "month")).toBe("month");
    expect(pickChoice("", views, "month")).toBe("month");
  });
});
