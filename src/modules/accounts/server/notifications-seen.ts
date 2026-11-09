import { prisma } from "@/server/db/client";
import * as accounts from "./account-repository";

// When the person last opened their notifications: everything after it is new for them, in every business.

export async function notificationsSeenAt(userId: string): Promise<Date | null> {
  return (await accounts.findNotificationsSeenAt(prisma, userId))?.notificationsSeenAt ?? null;
}

/** Opening the bell or the notifications page marks everything up to now as read. */
export async function markNotificationsSeen(userId: string, now = new Date()): Promise<void> {
  await accounts.markNotificationsSeen(prisma, userId, now);
}
