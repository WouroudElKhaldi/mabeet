import type { Db, Tx } from "@/server/db/client";

// Everything held about one person, for "download my data", and the checks before deleting an account.

export function findMyData(db: Db, userId: string) {
  return db.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      email: true,
      phone: true,
      locale: true,
      createdAt: true,
      bookings: {
        orderBy: { createdAt: "desc" },
        select: {
          reference: true,
          status: true,
          checkIn: true,
          checkOut: true,
          guestCount: true,
          guestName: true,
          guestPhone: true,
          guestEmail: true,
          guestNote: true,
          totalCents: true,
          currency: true,
          createdAt: true,
          business: { select: { name: true } },
          room: { select: { name: true } },
        },
      },
      sessionBookings: {
        orderBy: { createdAt: "desc" },
        select: {
          reference: true,
          status: true,
          seats: true,
          guestName: true,
          guestPhone: true,
          guestEmail: true,
          guestNote: true,
          totalCents: true,
          currency: true,
          createdAt: true,
          offering: { select: { title: true } },
          session: { select: { startsAt: true } },
          business: { select: { name: true } },
        },
      },
      reviews: {
        select: { rating: true, comment: true, createdAt: true, business: { select: { name: true } } },
      },
      favorites: { select: { createdAt: true, business: { select: { name: true } } } },
      memberships: {
        select: {
          status: true,
          createdAt: true,
          business: { select: { name: true } },
          role: { select: { name: true } },
        },
      },
      activities: {
        orderBy: { createdAt: "desc" },
        select: { action: true, entity: true, createdAt: true },
      },
      hostProfile: {
        select: {
          displayName: true,
          bio: true,
          city: true,
          languages: true,
          hostingSince: true,
          showOnListings: true,
          updatedAt: true,
        },
      },
      aiChats: {
        orderBy: { updatedAt: "desc" },
        select: {
          surface: true,
          title: true,
          createdAt: true,
          business: { select: { name: true } },
          messages: { orderBy: { createdAt: "asc" }, select: { role: true, content: true, createdAt: true } },
        },
      },
      // Names and dates only: a key's hash and a device's push keys are secrets, not personal data to hand out.
      apiKeys: {
        select: {
          name: true,
          prefix: true,
          canWrite: true,
          createdAt: true,
          lastUsedAt: true,
          revokedAt: true,
        },
      },
      pushSubscriptions: { select: { createdAt: true } },
    },
  });
}

/** Active businesses where this person is the only active owner: deleting them would orphan the place. */
export async function listSoleOwnedBusinesses(db: Db, userId: string): Promise<string[]> {
  const owned = await db.membership.findMany({
    where: { userId, status: "ACTIVE", role: { isOwner: true }, business: { status: "ACTIVE" } },
    select: { businessId: true, business: { select: { name: true } } },
  });
  const sole: string[] = [];
  for (const membership of owned) {
    const owners = await db.membership.count({
      where: { businessId: membership.businessId, status: "ACTIVE", role: { isOwner: true } },
    });
    if (owners === 1) sole.push(membership.business.name);
  }
  return sole;
}

/**
 * Marks the person deleted instead of deleting the row. Their email moves to `deletedEmail` and the address is
 * freed, so no one can sign in as them and they can sign up again later. Their memberships, keys, favourites,
 * chats and host profile are marked deleted too. Sign-in sessions, push devices and AI-app tokens are technical
 * rows and are deleted, which signs them out everywhere. Bookings and reviews stay with the host.
 * Run in a transaction.
 */
export async function softDeleteUser(tx: Tx, userId: string, now: Date) {
  const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true } });
  await tx.user.update({
    where: { id: userId },
    data: {
      isDeleted: true,
      deletedEmail: user.email,
      email: `deleted-${userId}@deleted.invalid`,
      emailVerified: false,
    },
  });
  await tx.membership.updateMany({ where: { userId }, data: { status: "REMOVED", isDeleted: true } });
  await tx.apiKey.updateMany({ where: { createdById: userId, revokedAt: null }, data: { revokedAt: now } });
  await tx.apiKey.updateMany({ where: { createdById: userId }, data: { isDeleted: true } });
  await tx.favorite.updateMany({ where: { userId }, data: { isDeleted: true } });
  await tx.aiChatMessage.updateMany({ where: { chat: { userId } }, data: { isDeleted: true } });
  await tx.aiChat.updateMany({ where: { userId }, data: { isDeleted: true } });
  await tx.hostProfile.updateMany({ where: { userId }, data: { isDeleted: true, showOnListings: false } });
  await tx.session.deleteMany({ where: { userId } });
  await tx.pushSubscription.deleteMany({ where: { userId } });
  await tx.oauthAccessToken.deleteMany({ where: { userId } });
  await tx.oauthRefreshToken.deleteMany({ where: { userId } });
  await tx.oauthConsent.deleteMany({ where: { userId } });
}

/** Gives this person the platform admin role: every business, on the website only. */
export function makePlatformAdmin(db: Db, userId: string) {
  return db.user.update({
    where: { id: userId },
    data: { platformRole: "SUPER_ADMIN" },
    select: { id: true },
  });
}

export function findUserByEmail(db: Db, email: string) {
  return db.user.findFirst({ where: { email: email.toLowerCase(), isDeleted: false } });
}

export function findUserById(db: Db, userId: string) {
  return db.user.findFirst({ where: { id: userId, isDeleted: false }, select: { email: true } });
}
