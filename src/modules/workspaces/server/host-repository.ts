import type { BusinessStatus, HostContact, Plan, Prisma } from "@prisma/client";
import type { Db } from "@/server/db/client";

/**
 * The person guests meet as a place's host: its first owner still on the team, with their account name and host
 * profile. A place can have several owners; the one who has owned it longest is the host, so the page never changes
 * when another owner joins.
 */
export function findPlaceHost(db: Db, businessId: string) {
  return db.membership.findFirst({
    where: {
      businessId,
      status: "ACTIVE",
      isDeleted: false,
      role: { isOwner: true, isDeleted: false },
      user: { isDeleted: false },
    },
    orderBy: { createdAt: "asc" },
    select: {
      user: {
        select: {
          name: true,
          hostProfile: {
            select: {
              displayName: true,
              bio: true,
              city: true,
              languages: true,
              hostingSince: true,
              showOnListings: true,
              contactBy: true,
              isDeleted: true,
            },
          },
        },
      },
    },
  });
}

/**
 * One host for the platform admin: their account, their host profile and every business they own, with how big each
 * is. Null when there is no such person, or they own nothing.
 */
export function findHostForAdmin(db: Db, userId: string) {
  return db.user.findFirst({
    where: {
      id: userId,
      isDeleted: false,
      memberships: {
        some: { status: "ACTIVE", isDeleted: false, role: { isOwner: true, isDeleted: false } },
      },
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      createdAt: true,
      hostProfile: {
        select: {
          displayName: true,
          bio: true,
          city: true,
          languages: true,
          hostingSince: true,
          showOnListings: true,
          isDeleted: true,
        },
      },
      memberships: {
        where: { status: "ACTIVE", isDeleted: false, role: { isOwner: true, isDeleted: false } },
        orderBy: { createdAt: "asc" },
        select: {
          business: {
            select: {
              id: true,
              name: true,
              slug: true,
              area: true,
              status: true,
              plan: true,
              planRenewsAt: true,
              stripeSubscriptionId: true,
              isDeleted: true,
              createdAt: true,
              _count: {
                select: {
                  rooms: { where: { isDeleted: false } },
                  offerings: { where: { isDeleted: false } },
                  bookings: { where: { isDeleted: false } },
                  memberships: { where: { status: "ACTIVE", isDeleted: false } },
                },
              },
            },
          },
        },
      },
    },
  });
}

const OWN_PROFILE = {
  displayName: true,
  bio: true,
  city: true,
  languages: true,
  hostingSince: true,
  showOnListings: true,
  contactBy: true,
} as const;

/** The person's own host profile, to edit. Null when they never saved one. */
export function findOwnHostProfile(db: Db, userId: string) {
  return db.hostProfile.findFirst({ where: { userId, isDeleted: false }, select: OWN_PROFILE });
}

export interface HostProfileFields {
  displayName: string | null;
  bio: string | null;
  city: string | null;
  languages: string[];
  hostingSince: number | null;
  showOnListings: boolean;
  contactBy: HostContact;
}

/** Saves the profile on its key, the person: a first save creates it, and a deleted one comes back. */
export function saveHostProfile(db: Db, userId: string, fields: HostProfileFields) {
  return db.hostProfile.upsert({
    where: { userId },
    create: { userId, ...fields },
    update: { ...fields, isDeleted: false },
    select: OWN_PROFILE,
  });
}

export interface HostFilters {
  /** Words in the host's name, email or phone, or in one of their places' names. */
  q: string;
  /** Hosts with at least one place in this status. */
  status?: BusinessStatus;
  /** Hosts with at least one place on this plan. */
  plan?: Plan;
}

/** A place the person owns and is still on the team of. */
const ownedPlace = {
  status: "ACTIVE",
  isDeleted: false,
  role: { isOwner: true, isDeleted: false },
} as const satisfies Prisma.MembershipWhereInput;

function hostWhere({ q, status, plan }: HostFilters): Prisma.UserWhereInput {
  const business = { isDeleted: false, ...(status ? { status } : {}), ...(plan ? { plan } : {}) };
  const words = { contains: q, mode: "insensitive" } as const;
  return {
    isDeleted: false,
    memberships: { some: { ...ownedPlace, business } },
    ...(q
      ? {
          OR: [
            { name: words },
            { email: words },
            { phone: words },
            { memberships: { some: { ...ownedPlace, business: { ...business, name: words } } } },
          ],
        }
      : {}),
  };
}

/** One page of the hosts for the platform admin, the newest first, each with the live places they own. */
export function listHostsForAdmin(db: Db, filters: HostFilters, page: { skip: number; take: number }) {
  return db.user.findMany({
    where: hostWhere(filters),
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    ...page,
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      createdAt: true,
      memberships: {
        where: { ...ownedPlace, business: { isDeleted: false } },
        orderBy: { createdAt: "asc" },
        select: { business: { select: { id: true, name: true, status: true, plan: true } } },
      },
    },
  });
}

export function countHostsForAdmin(db: Db, filters: HostFilters) {
  return db.user.count({ where: hostWhere(filters) });
}
