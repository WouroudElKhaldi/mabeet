-- Plan offers: a platform admin gives hosts a paid plan free, or a share off its price, for every place or one,
-- for each place's first months or between two dates. A free offer is claimed once per place.

-- CreateEnum
CREATE TYPE "OfferKind" AS ENUM ('FREE', 'PERCENT_OFF');

-- AlterTable
ALTER TABLE "PlanPayment" ADD COLUMN     "offerId" TEXT;

-- CreateTable
CREATE TABLE "PlanOffer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "plan" "Plan" NOT NULL,
    "kind" "OfferKind" NOT NULL,
    "percentOff" INTEGER,
    "businessId" TEXT,
    "firstMonths" INTEGER,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanOfferClaim" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanOfferClaim_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlanOffer_businessId_idx" ON "PlanOffer"("businessId");

-- CreateIndex
CREATE INDEX "PlanOfferClaim_businessId_idx" ON "PlanOfferClaim"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "PlanOfferClaim_offerId_businessId_key" ON "PlanOfferClaim"("offerId", "businessId");

-- AddForeignKey
ALTER TABLE "PlanPayment" ADD CONSTRAINT "PlanPayment_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "PlanOffer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanOffer" ADD CONSTRAINT "PlanOffer_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanOffer" ADD CONSTRAINT "PlanOffer_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanOfferClaim" ADD CONSTRAINT "PlanOfferClaim_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "PlanOffer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanOfferClaim" ADD CONSTRAINT "PlanOfferClaim_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- An offer is whole: on a paid plan, a share only when it is one, and exactly one kind of time. Each branch says
-- IS NOT NULL itself: a comparison with NULL is unknown, and CHECK lets unknown through.
ALTER TABLE "PlanOffer"
  ADD CONSTRAINT plan_offer_paid_plan CHECK (plan <> 'FREE'),
  ADD CONSTRAINT plan_offer_percent CHECK (
    (kind = 'PERCENT_OFF' AND "percentOff" IS NOT NULL AND "percentOff" BETWEEN 1 AND 99) OR (kind = 'FREE' AND "percentOff" IS NULL)
  ),
  ADD CONSTRAINT plan_offer_shape CHECK (
    ("firstMonths" IS NOT NULL AND "firstMonths" BETWEEN 1 AND 24 AND "startsAt" IS NULL AND "endsAt" IS NULL)
    OR ("firstMonths" IS NULL AND "startsAt" IS NOT NULL AND "endsAt" IS NOT NULL AND "endsAt" > "startsAt")
  );
