import type { OfferKind, Plan, Prisma } from "@prisma/client";
import type { Db, Tx } from "@/server/db/client";

// Plan offers and the free ones hosts took. An offer is never deleted: ending it sets isDeleted, and what it already
// gave (a claim, a discounted payment) stays.

const offerFields = {
  id: true,
  name: true,
  plan: true,
  kind: true,
  percentOff: true,
  hostId: true,
  firstMonths: true,
  startsAt: true,
  endsAt: true,
} as const;

export interface NewOffer {
  name: string;
  plan: Plan;
  kind: OfferKind;
  percentOff: number | null;
  hostId: string | null;
  firstMonths: number | null;
  startsAt: Date | null;
  endsAt: Date | null;
  createdById: string;
}

export function createOffer(tx: Tx, offer: NewOffer) {
  return tx.planOffer.create({ data: offer, select: { id: true } });
}

export interface OfferFilters {
  /** Words in the offer's name or the name of the host it is for. */
  q: string;
  kind?: OfferKind;
}

function offerWhere({ q, kind }: OfferFilters): Prisma.PlanOfferWhereInput {
  const words = { contains: q, mode: "insensitive" } as const;
  return {
    ...(kind ? { kind } : {}),
    ...(q ? { OR: [{ name: words }, { host: { name: words } }] } : {}),
  };
}

/**
 * One page of the offers for the admin, the newest first, ended ones too, with the host each is for and how much it
 * was used.
 */
export function listOffers(db: Db, filters: OfferFilters, page: { skip: number; take: number }) {
  return db.planOffer.findMany({
    where: offerWhere(filters),
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    ...page,
    select: {
      ...offerFields,
      isDeleted: true,
      createdAt: true,
      host: { select: { name: true } },
      _count: {
        select: {
          claims: { where: { isDeleted: false } },
          payments: { where: { status: "PAID", isDeleted: false } },
        },
      },
    },
  });
}

export function countOffers(db: Db, filters: OfferFilters) {
  return db.planOffer.count({ where: offerWhere(filters) });
}

/** The offers not ended that are for this host: their own, and those for every host. */
export function listOffersFor(db: Db, hostId: string) {
  return db.planOffer.findMany({
    where: { isDeleted: false, OR: [{ hostId: null }, { hostId }] },
    orderBy: { createdAt: "asc" },
    select: offerFields,
  });
}

/** Ends an offer. False when there was no such offer still running. */
export async function endOffer(tx: Tx, offerId: string) {
  const { count } = await tx.planOffer.updateMany({
    where: { id: offerId, isDeleted: false },
    data: { isDeleted: true },
  });
  return count > 0;
}

/** The free offers this host already took. */
export async function listClaimedOfferIds(db: Db, hostId: string) {
  const claims = await db.planOfferClaim.findMany({
    where: { hostId, isDeleted: false },
    select: { offerId: true },
  });
  return new Set(claims.map((claim) => claim.offerId));
}

/** Records a host taking a free offer. The unique key refuses a second claim of the same offer (P2002). */
export function createClaim(tx: Tx, claim: { offerId: string; hostId: string; endsAt: Date }) {
  return tx.planOfferClaim.create({ data: claim, select: { id: true } });
}
