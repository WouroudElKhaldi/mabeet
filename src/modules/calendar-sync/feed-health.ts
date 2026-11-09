// When a calendar link needs a look. The worker reads every link every ten minutes, so a link not read for an hour
// is stuck; a link whose last read failed says why. The host's Channels page and the admin's health page use the same
// rule, so they never disagree.

/** How long a link may go without a read before it needs a look. */
export const FEED_STALE_AFTER_MS = 60 * 60_000;

/** True when the last read failed, or the link has not been read for an hour (counting from when it was added). */
export function feedNeedsLook(
  feed: { lastError: string | null; lastSyncedAt: Date | null; createdAt: Date },
  now = new Date(),
): boolean {
  const lastRead = feed.lastSyncedAt ?? feed.createdAt;
  return feed.lastError !== null || now.getTime() - lastRead.getTime() > FEED_STALE_AFTER_MS;
}
