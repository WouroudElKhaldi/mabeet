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
