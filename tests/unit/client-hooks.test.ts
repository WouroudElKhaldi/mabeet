import { describe, expect, it } from "vitest";
import { isSafeRedirect } from "@/hooks/use-redirect-action";
import { createSingleFlight } from "@/hooks/use-action";
import { settledFor } from "@/hooks/use-live-query";
import { pickChoice } from "@/hooks/use-stored-choice";

describe("isSafeRedirect", () => {
  const site = "http://localhost:3000";

  it("follows a page of this site and an https address, such as a payment page", () => {
    expect(isSafeRedirect("/b/abc123", site)).toBe(true);
    expect(isSafeRedirect("/whish-simulator?pay=1", site)).toBe(true);
    expect(isSafeRedirect("https://checkout.stripe.com/c/pay/cs_test_1", site)).toBe(true);
  });

  it("follows this site's own full address, even over http on a computer running the site", () => {
    expect(isSafeRedirect("http://localhost:3000/whish-simulator/pay/kKjXTvy7", site)).toBe(true);
    expect(isSafeRedirect("http://localhost:4000/whish-simulator/pay/kKjXTvy7", site)).toBe(false);
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
      expect(isSafeRedirect(url, site), url).toBe(false);
    }
  });

  it("refuses a missing or wrong answer from the server", () => {
    expect(isSafeRedirect(undefined, site)).toBe(false);
    expect(isSafeRedirect(null, site)).toBe(false);
    expect(isSafeRedirect(42, site)).toBe(false);
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

describe("createSingleFlight", () => {
  it("says no to a second start while one run is going, so a double click cannot save twice", () => {
    const flight = createSingleFlight();
    const end = flight.start();
    expect(end).not.toBeNull();
    expect(flight.start()).toBeNull();
    expect(flight.start()).toBeNull();
    end?.();
    expect(flight.start()).not.toBeNull();
  });

  it("lets the next run start after the first ended, and ending twice changes nothing", () => {
    const flight = createSingleFlight();
    const first = flight.start();
    first?.();
    const second = flight.start();
    first?.();
    expect(flight.start()).toBeNull();
    second?.();
    expect(flight.start()).not.toBeNull();
  });
});

describe("settledFor", () => {
  const forNov14 = { key: "/q?d=14", data: { total: 120 }, caught: null };

  it("accepts the answer to the question being asked now", () => {
    expect(settledFor("/q?d=14", forNov14)).toBe(forNov14);
  });

  it("refuses a late answer to an older question: a price for other nights would be a lie", () => {
    expect(settledFor("/q?d=15", forNov14)).toBeNull();
  });

  it("has no answer when nothing is asked, or nothing came back yet", () => {
    expect(settledFor(null, forNov14)).toBeNull();
    expect(settledFor("/q?d=14", null)).toBeNull();
  });
});
