import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/server/errors";
import { clientAddress, enforceRateLimit, resetMemoryRateLimits } from "@/server/http/rate-limit";

// Tests run without REDIS_URL, so this exercises the in-memory store; production counts the same way in Redis
// with one atomic script per hit.
describe("rate limits", () => {
  beforeEach(resetMemoryRateLimits);
  afterEach(() => vi.useRealTimers());

  it("lets exactly the limit through when requests arrive at the same moment", async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 20 }, () => enforceRateLimit("test:burst", 5, 60_000)),
    );
    const refused = results.filter((result): result is PromiseRejectedResult => result.status === "rejected");
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(5);
    for (const { reason } of refused) {
      expect(reason).toBeInstanceOf(AppError);
      expect((reason as AppError).code).toBe("RATE_LIMITED");
    }
  });

  it("says when to retry, and starts a fresh window once the old one has ended", async () => {
    vi.useFakeTimers({ now: new Date("2026-11-01T10:00:00Z") });
    await enforceRateLimit("test:window", 1, 60_000);
    await expect(enforceRateLimit("test:window", 1, 60_000)).rejects.toMatchObject({
      code: "RATE_LIMITED",
      details: { retryAfterSeconds: 60 },
    });
    vi.advanceTimersByTime(60_000);
    await expect(enforceRateLimit("test:window", 1, 60_000)).resolves.toBeUndefined();
  });

  it("keeps separate keys apart", async () => {
    await enforceRateLimit("test:a", 1, 60_000);
    await expect(enforceRateLimit("test:b", 1, 60_000)).resolves.toBeUndefined();
  });

  it("counts a public form per visitor, from the address the proxy sets", () => {
    const from = (headers: Record<string, string>) => new Request("https://mabeet.app/api/test", { headers });
    expect(clientAddress(from({ "x-real-ip": "203.0.113.7" }))).toBe("203.0.113.7");
    expect(clientAddress(from({ "x-forwarded-for": "198.51.100.2, 10.0.0.1" }))).toBe("198.51.100.2");
    expect(clientAddress(from({}))).toBe("local");
  });
});
