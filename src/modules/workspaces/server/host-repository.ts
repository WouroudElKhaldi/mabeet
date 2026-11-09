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
