-- Featured partners and sponsored listings (F23; docs/team/07-data-model.md, section 5): places near guesthouses
-- that are not on the platform, and the dates during which a partner or an experience is sponsored. New tables, so
-- no existing row can break their rules.

-- CreateEnum
CREATE TYPE "PartnerKind" AS ENUM ('RESTAURANT', 'CAFE', 'SUPERMARKET', 'PARK', 'MUSEUM', 'BEACH', 'WINERY', 'OTHER');

-- CreateTable
CREATE TABLE "PartnerPlace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "PartnerKind" NOT NULL,
    "region" TEXT NOT NULL,
    "area" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "photoUrl" TEXT,
    "websiteUrl" TEXT,
    "phone" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerPlace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sponsorship" (
    "id" TEXT NOT NULL,
    "partnerPlaceId" TEXT,
    "offeringId" TEXT,
    "startsOn" DATE NOT NULL,
    "endsOn" DATE NOT NULL,
    "createdById" TEXT NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sponsorship_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PartnerPlace_region_idx" ON "PartnerPlace"("region");

-- CreateIndex
CREATE INDEX "Sponsorship_startsOn_endsOn_idx" ON "Sponsorship"("startsOn", "endsOn");

-- CreateIndex
CREATE INDEX "Sponsorship_partnerPlaceId_idx" ON "Sponsorship"("partnerPlaceId");

-- CreateIndex
CREATE INDEX "Sponsorship_offeringId_idx" ON "Sponsorship"("offeringId");

-- AddForeignKey
ALTER TABLE "Sponsorship" ADD CONSTRAINT "Sponsorship_partnerPlaceId_fkey" FOREIGN KEY ("partnerPlaceId") REFERENCES "PartnerPlace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sponsorship" ADD CONSTRAINT "Sponsorship_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "Offering"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sponsorship" ADD CONSTRAINT "Sponsorship_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Rules Prisma's schema language cannot express. A sponsorship is for exactly one thing, and it lasts at least a day
-- (endsOn is the day after the last one, like a check-out).
ALTER TABLE "Sponsorship"
  ADD CONSTRAINT sponsorship_one_target CHECK (("partnerPlaceId" IS NULL) <> ("offeringId" IS NULL)),
  ADD CONSTRAINT sponsorship_valid_dates CHECK ("endsOn" > "startsOn");
