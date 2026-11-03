import { describe, expect, it } from "vitest";
import { isPushServiceUrl } from "@/server/push/endpoints";
import { pushSubscriptionInput } from "..";

// Push devices come only from real browser push services.

describe("push service addresses", () => {
  it("accepts the browsers' push services", () => {
    for (const endpoint of [
      "https://fcm.googleapis.com/fcm/send/abc",
      "https://updates.push.services.mozilla.com/wpush/v2/abc",
      "https://web.push.apple.com/abc",
      "https://wns2-par02p.notify.windows.com/w/?token=abc",
    ]) {
      expect(isPushServiceUrl(endpoint), endpoint).toBe(true);
    }
  });

  it("refuses any other address, and plain http", () => {
    for (const endpoint of [
      "https://attacker.example/fcm.googleapis.com",
      "https://fcm.googleapis.com.attacker.example/x",
      "http://fcm.googleapis.com/fcm/send/abc",
      "https://localhost/push",
      "not a url",
    ]) {
      expect(isPushServiceUrl(endpoint), endpoint).toBe(false);
    }
  });

  it("checks a device turning push on", () => {
    const device = {
      endpoint: "https://fcm.googleapis.com/fcm/send/abc",
      keys: { p256dh: "key", auth: "secret" },
    };
    expect(pushSubscriptionInput.safeParse(device).success).toBe(true);
    expect(pushSubscriptionInput.safeParse({ ...device, endpoint: "https://example.com/x" }).success).toBe(
      false,
    );
    expect(pushSubscriptionInput.safeParse({ endpoint: device.endpoint, keys: { p256dh: "" } }).success).toBe(
      false,
    );
  });
});
