import type { Db } from "@/server/db/client";

// The OAuth rows behind an AI app connected by signing in: the place picked on the sign-in session, the app's name,
// and the member's consents. Access tokens are signed, not stored, so a connection lives in its consent and its
// refresh tokens.

/** The place picked while connecting an AI app, kept on the sign-in session for the rest of that authorization. */
export async function setSessionWorkspace(db: Db, sessionId: string, businessId: string) {
  await db.session.update({ where: { id: sessionId }, data: { mcpBusinessId: businessId } });
}

export async function findClientName(db: Db, clientId: string): Promise<string | null> {
  return (await db.oauthClient.findUnique({ where: { clientId }, select: { name: true } }))?.name ?? null;
}

/** Whether the member still allows this app in this place. */
export async function hasConsent(db: Db, userId: string, clientId: string, businessId: string) {
  return (await db.oauthConsent.count({ where: { userId, clientId, referenceId: businessId } })) > 0;
}

/** The apps the member connected to this place, newest first. */
export function listConsents(db: Db, userId: string, businessId: string) {
  return db.oauthConsent.findMany({
    where: { userId, referenceId: businessId },
    select: { id: true, createdAt: true, client: { select: { clientId: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Ends one of the member's connections in this place: its consent and the refresh tokens it was given. False when it
 * is not theirs. Tokens are really deleted, like sessions.
 */
export async function deleteConsent(db: Db, userId: string, businessId: string, consentId: string) {
  const consent = await db.oauthConsent.findFirst({
    where: { id: consentId, userId, referenceId: businessId },
    select: { clientId: true },
  });
  if (!consent) return false;
  const connection = { userId, clientId: consent.clientId, referenceId: businessId };
  await db.oauthAccessToken.deleteMany({ where: connection });
  await db.oauthRefreshToken.deleteMany({ where: connection });
  await db.oauthConsent.deleteMany({ where: connection });
  return true;
}
