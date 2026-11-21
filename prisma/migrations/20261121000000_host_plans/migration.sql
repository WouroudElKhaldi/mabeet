-- Plans move from each place to its host: one plan per host account, shared by every place it hosts (rooms and
-- team counted across them). The host of a place is whoever created it: its first owner. Every step below moves
-- what exists before the old columns go, so no plan, payment, offer or claim is lost.

-- 1. Each place's host: its first owner, else (a place whose owners all left) its first member.
ALTER TABLE "Business" ADD COLUMN "hostId" TEXT;

UPDATE "Business" AS b
SET "hostId" = (
  SELECT m."userId"
  FROM "Membership" m
  JOIN "Role" r ON r.id = m."roleId"
  WHERE m."businessId" = b.id
  ORDER BY r."isOwner" DESC, m."createdAt" ASC
  LIMIT 1
);

-- A place that never had anyone on its team (made straight in the database) is held by the first platform admin,
-- who can hand it to its real host from the admin pages.
UPDATE "Business"
SET "hostId" = (SELECT id FROM "User" WHERE "platformRole" = 'SUPER_ADMIN' ORDER BY "createdAt" ASC LIMIT 1)
WHERE "hostId" IS NULL;

ALTER TABLE "Business" ALTER COLUMN "hostId" SET NOT NULL;

-- 2. Each host's plan: the highest of their places' plans (the enum runs from FREE to PREMIUM), with its end date and
--    Stripe ids. Among equal plans, the one paid by card wins, then the one with no end date, then the latest end.
CREATE TABLE "HostPlan" (
    "userId" TEXT NOT NULL,
    "plan" "Plan" NOT NULL DEFAULT 'FREE',
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "planRenewsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HostPlan_pkey" PRIMARY KEY ("userId")
);

INSERT INTO "HostPlan" ("userId", "plan", "stripeCustomerId", "stripeSubscriptionId", "planRenewsAt", "updatedAt")
SELECT DISTINCT ON ("hostId")
  "hostId", "plan", "stripeCustomerId", "stripeSubscriptionId", "planRenewsAt", CURRENT_TIMESTAMP
FROM "Business"
ORDER BY "hostId", "plan" DESC, ("stripeSubscriptionId" IS NOT NULL) DESC, "planRenewsAt" DESC NULLS FIRST;

-- 3. Payments, offers and claims point to the host of the place they were for.
ALTER TABLE "PlanPayment" ADD COLUMN "hostId" TEXT;
UPDATE "PlanPayment" p SET "hostId" = b."hostId" FROM "Business" b WHERE b.id = p."businessId";
ALTER TABLE "PlanPayment" ALTER COLUMN "hostId" SET NOT NULL;

ALTER TABLE "PlanOffer" ADD COLUMN "hostId" TEXT;
UPDATE "PlanOffer" o SET "hostId" = b."hostId" FROM "Business" b WHERE b.id = o."businessId";

ALTER TABLE "PlanOfferClaim" ADD COLUMN "hostId" TEXT;
UPDATE "PlanOfferClaim" c SET "hostId" = b."hostId" FROM "Business" b WHERE b.id = c."businessId";
ALTER TABLE "PlanOfferClaim" ALTER COLUMN "hostId" SET NOT NULL;
-- A host who took the same free offer for two places keeps one claim, the one that runs longest.
DELETE FROM "PlanOfferClaim" c
USING "PlanOfferClaim" other
WHERE c."offerId" = other."offerId" AND c."hostId" = other."hostId" AND c.id <> other.id
  AND (c."endsAt", c.id) < (other."endsAt", other.id);

-- 4. The old per-place columns go.
ALTER TABLE "PlanOffer" DROP CONSTRAINT "PlanOffer_businessId_fkey";
ALTER TABLE "PlanOfferClaim" DROP CONSTRAINT "PlanOfferClaim_businessId_fkey";
ALTER TABLE "PlanPayment" DROP CONSTRAINT "PlanPayment_businessId_fkey";
DROP INDEX "Business_stripeCustomerId_key";
DROP INDEX "Business_stripeSubscriptionId_key";
DROP INDEX "PlanOffer_businessId_idx";
DROP INDEX "PlanOfferClaim_businessId_idx";
DROP INDEX "PlanOfferClaim_offerId_businessId_key";
DROP INDEX "PlanPayment_businessId_idx";
ALTER TABLE "Business" DROP COLUMN "plan",
DROP COLUMN "planRenewsAt",
DROP COLUMN "stripeCustomerId",
DROP COLUMN "stripeSubscriptionId";
ALTER TABLE "PlanOffer" DROP COLUMN "businessId";
ALTER TABLE "PlanOfferClaim" DROP COLUMN "businessId";
ALTER TABLE "PlanPayment" DROP COLUMN "businessId";

-- 5. Indexes and keys.
CREATE UNIQUE INDEX "HostPlan_stripeCustomerId_key" ON "HostPlan"("stripeCustomerId");
CREATE UNIQUE INDEX "HostPlan_stripeSubscriptionId_key" ON "HostPlan"("stripeSubscriptionId");
CREATE INDEX "Business_hostId_idx" ON "Business"("hostId");
CREATE INDEX "PlanOffer_hostId_idx" ON "PlanOffer"("hostId");
CREATE INDEX "PlanOfferClaim_hostId_idx" ON "PlanOfferClaim"("hostId");
CREATE UNIQUE INDEX "PlanOfferClaim_offerId_hostId_key" ON "PlanOfferClaim"("offerId", "hostId");
CREATE INDEX "PlanPayment_hostId_idx" ON "PlanPayment"("hostId");

ALTER TABLE "Business" ADD CONSTRAINT "Business_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PlanPayment" ADD CONSTRAINT "PlanPayment_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PlanOffer" ADD CONSTRAINT "PlanOffer_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PlanOfferClaim" ADD CONSTRAINT "PlanOfferClaim_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HostPlan" ADD CONSTRAINT "HostPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
