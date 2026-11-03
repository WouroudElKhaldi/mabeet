import type { Db } from "@/server/db/client";
import type { PushDevice } from "@/server/push/send";

// Push devices. Like sessions, they are really deleted: a device that turned push off, or that its push service
// says is gone, has nothing worth keeping.

/**
 * Saves a device for a person. An address is one browser, so it has one row: turning push on again replaces its
 * keys, and when someone else signs in on that browser and turns it on, the device becomes theirs.
 */
export async function saveDevice(db: Db, userId: string, device: PushDevice): Promise<void> {
  await db.pushSubscription.upsert({
    where: { endpoint: device.endpoint },
    create: { userId, ...device },
    update: { userId, p256dh: device.p256dh, auth: device.auth },
  });
}

/** Forgets a person's own device. Someone else's device at that address is left alone. */
export async function deleteDevice(db: Db, userId: string, endpoint: string): Promise<void> {
  await db.pushSubscription.deleteMany({ where: { userId, endpoint } });
}

export async function deleteDevices(db: Db, ids: string[]): Promise<void> {
  await db.pushSubscription.deleteMany({ where: { id: { in: ids } } });
}

/** Every device of these people whose accounts are still open. */
export function listDevices(db: Db, userIds: readonly string[]) {
  return db.pushSubscription.findMany({
    where: { userId: { in: [...userIds] }, user: { isDeleted: false } },
    select: { id: true, userId: true, endpoint: true, p256dh: true, auth: true },
  });
}
