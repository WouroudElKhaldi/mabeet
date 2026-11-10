-- AlterTable
ALTER TABLE "Sponsorship" ADD COLUMN     "businessId" TEXT;

-- CreateIndex
CREATE INDEX "Sponsorship_businessId_idx" ON "Sponsorship"("businessId");

-- AddForeignKey
ALTER TABLE "Sponsorship" ADD CONSTRAINT "Sponsorship_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A sponsorship is now for exactly one of three things: a partner place, an experience or service, or a guesthouse.
ALTER TABLE "Sponsorship" DROP CONSTRAINT sponsorship_one_target;
ALTER TABLE "Sponsorship"
  ADD CONSTRAINT sponsorship_one_target CHECK (num_nonnulls("partnerPlaceId", "offeringId", "businessId") = 1);
