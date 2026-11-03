import { recordSystemEvent } from "@/modules/audit/server";
import { runInTransaction, type Tx } from "@/server/db/client";
import { todayUtc } from "@/utils/dates";
import { notifyImportClash } from "./booking-notifications";
import { type ClashChange, flagImportClashes, lockActiveRoom } from "./booking-repository";

// A platform stay (Airbnb, Booking.com) over nights we already sold or closed is kept as a live IMPORTED row with
// `conflict = true`: it is a real guest, so its nights stay blocked and nothing is cancelled. The flag follows our
// side at once: whenever our own nights change, the room's platform stays are checked again.

/**
 * Re-flags the room's platform stays against our own nights and puts each clash that appeared or cleared in the
 * bell. A stay that simply ended is not news. The caller holds the room lock.
 */
async function flagClashes(tx: Tx, businessId: string, roomId: string, now: Date) {
  const today = todayUtc(now);
  const changes = await flagImportClashes(tx, businessId, roomId);
  for (const change of changes) {
    if (!change.conflict && change.checkOut <= today) continue;
    await recordSystemEvent(tx, {
      businessId,
      action: change.conflict ? "calendar.conflict" : "calendar.conflict_resolved",
      entity: "occupancy",
      entityId: change.id,
    });
  }
  return changes;
}

/** Emails the people who decide bookings about each new clash. Cleared ones only reach the bell and the calendar. */
function announceClashes(changes: readonly ClashChange[], now: Date) {
  for (const change of changes) {
    if (change.conflict) notifyImportClash(change.id, now);
  }
}

/**
 * Our side of a room changed (a booking ended, dates were closed or reopened): re-checks its platform stays at once
 * instead of at the next calendar sync. Runs after that change committed, in its own transaction, and never throws
 * at it: if it fails, the next sync settles the flags.
 */
export async function recheckImportClashes(businessId: string, roomId: string, now = new Date()) {
  try {
    const changes = await runInTransaction(async (tx) => {
      if (!(await lockActiveRoom(tx, businessId, roomId))) return [];
      return flagClashes(tx, businessId, roomId, now);
    });
    announceClashes(changes, now);
  } catch (error) {
    console.error("[bookings] could not re-check platform clashes", error);
  }
}
