import type { PriceUnit } from "@prisma/client";
import { type Db, prisma, type Tx } from "@/server/db/client";
import * as offerings from "./offering-repository";

// What the booking engine reads and changes of an offering and its sessions. Plain reads: the caller checks who may
// do what, and the seats taken are the booking engine's own.

/** An experience or service guests can book, by its public link. Null when there is none. */
export function findBookableOffering(slug: string) {
  return offerings.findBookableOffering(prisma, slug);
}

/** A session of this offering that is live and has not started yet. Null otherwise. */
export function findOpenSession(offeringId: string, sessionId: string, now: Date, db: Db = prisma) {
  return offerings.findOpenSession(db, offeringId, sessionId, now);
}

/** Locks a live session of the business for the rest of the transaction. Null when there is none. */
export function lockSession(tx: Tx, businessId: string, sessionId: string) {
  return offerings.lockSession(tx, businessId, sessionId);
}

/** Takes a session off the schedule, inside the transaction that checked nobody is booked on it. */
export function closeSession(tx: Tx, businessId: string, sessionId: string) {
  return offerings.closeSession(tx, businessId, sessionId);
}

/** What `seats` cost: the price for each guest, or once for the whole group. The guest pays all of it. */
export function priceSession(offering: { priceCents: number; priceUnit: PriceUnit }, seats: number): number {
  return offering.priceUnit === "PER_PERSON" ? offering.priceCents * seats : offering.priceCents;
}
