import { describe, expect, it } from "vitest";
import { feedNeedsLook } from "../feed-health";

// A link needs a look when its last read failed, or nothing was read for an hour, counted from when it was added.

const NOW = new Date("2026-11-09T12:00:00Z");
const minutesAgo = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000);

describe("when a calendar link needs a look", () => {
  it("is fine when read in the last hour", () => {
    expect(
      feedNeedsLook({ lastError: null, lastSyncedAt: minutesAgo(20), createdAt: minutesAgo(600) }, NOW),
    ).toBe(false);
  });

  it("needs a look when the last read failed, however recent", () => {
    expect(
      feedNeedsLook(
        { lastError: "Airbnb did not answer", lastSyncedAt: minutesAgo(5), createdAt: minutesAgo(600) },
        NOW,
      ),
    ).toBe(true);
  });

  it("needs a look when nothing was read for an hour, but not a link just added", () => {
    expect(
      feedNeedsLook({ lastError: null, lastSyncedAt: minutesAgo(61), createdAt: minutesAgo(600) }, NOW),
    ).toBe(true);
    expect(feedNeedsLook({ lastError: null, lastSyncedAt: null, createdAt: minutesAgo(10) }, NOW)).toBe(
      false,
    );
    expect(feedNeedsLook({ lastError: null, lastSyncedAt: null, createdAt: minutesAgo(90) }, NOW)).toBe(true);
  });
});
