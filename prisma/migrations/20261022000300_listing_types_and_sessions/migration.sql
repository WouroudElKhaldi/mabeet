-- CreateEnum
CREATE TYPE "ListingKind" AS ENUM ('HOME', 'EXPERIENCE', 'SERVICE');

-- CreateEnum
CREATE TYPE "PriceUnit" AS ENUM ('PER_PERSON', 'PER_GROUP');

-- CreateEnum
CREATE TYPE "ActivityLevel" AS ENUM ('LIGHT', 'MODERATE', 'CHALLENGING');

-- CreateEnum
CREATE TYPE "SkillLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "accessibility" TEXT[],
ADD COLUMN     "minGuestAge" INTEGER,
ADD COLUMN     "tags" TEXT[];

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "kind" "ListingKind" NOT NULL DEFAULT 'HOME',
ADD COLUMN     "position" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "sessionBookingId" TEXT,
ALTER COLUMN "bookingId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Photo" ADD COLUMN     "offeringId" TEXT;

-- CreateTable
CREATE TABLE "Offering" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "kind" "ListingKind" NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "categorySlug" TEXT,
    "area" TEXT,
    "meetingPoint" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "durationMinutes" INTEGER NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "priceUnit" "PriceUnit" NOT NULL DEFAULT 'PER_PERSON',
    "maxGuests" INTEGER NOT NULL DEFAULT 10,
    "minAge" INTEGER,
    "activityLevel" "ActivityLevel",
    "skillLevel" "SkillLevel",
    "included" TEXT[],
    "notIncluded" TEXT[],
    "accessibility" TEXT[],
    "languages" TEXT[],
    "tags" TEXT[],
    "cancellationHours" INTEGER NOT NULL DEFAULT 24,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Offering_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfferingSession" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "offeringId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "capacity" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OfferingSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionBooking" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "publicToken" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "offeringId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "guestUserId" TEXT,
    "guestName" TEXT NOT NULL,
    "guestPhone" TEXT NOT NULL,
    "guestEmail" TEXT,
    "guestNote" TEXT,
    "seats" INTEGER NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "depositCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'HELD',
    "holdExpiresAt" TIMESTAMP(3),
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessionBooking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Offering_slug_key" ON "Offering"("slug");

-- CreateIndex
CREATE INDEX "Offering_businessId_idx" ON "Offering"("businessId");

-- CreateIndex
CREATE INDEX "Offering_kind_active_idx" ON "Offering"("kind", "active");

-- CreateIndex
CREATE INDEX "OfferingSession_offeringId_startsAt_idx" ON "OfferingSession"("offeringId", "startsAt");

-- CreateIndex
CREATE INDEX "OfferingSession_businessId_idx" ON "OfferingSession"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "SessionBooking_reference_key" ON "SessionBooking"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "SessionBooking_publicToken_key" ON "SessionBooking"("publicToken");

-- CreateIndex
CREATE INDEX "SessionBooking_businessId_status_idx" ON "SessionBooking"("businessId", "status");

-- CreateIndex
CREATE INDEX "SessionBooking_sessionId_idx" ON "SessionBooking"("sessionId");

-- CreateIndex
CREATE INDEX "SessionBooking_guestUserId_idx" ON "SessionBooking"("guestUserId");

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "Offering"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_sessionBookingId_fkey" FOREIGN KEY ("sessionBookingId") REFERENCES "SessionBooking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offering" ADD CONSTRAINT "Offering_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offering" ADD CONSTRAINT "Offering_categorySlug_fkey" FOREIGN KEY ("categorySlug") REFERENCES "Category"("slug") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferingSession" ADD CONSTRAINT "OfferingSession_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferingSession" ADD CONSTRAINT "OfferingSession_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "Offering"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionBooking" ADD CONSTRAINT "SessionBooking_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionBooking" ADD CONSTRAINT "SessionBooking_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "Offering"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionBooking" ADD CONSTRAINT "SessionBooking_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "OfferingSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionBooking" ADD CONSTRAINT "SessionBooking_guestUserId_fkey" FOREIGN KEY ("guestUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Hand-written guarantees (Prisma's schema language cannot express these).
-- tests/integration/session-seats.test.ts fails if a later migration drops them.
-- ---------------------------------------------------------------------------

-- A payment belongs to exactly one booking: a stay or a session.
ALTER TABLE "Payment"
  ADD CONSTRAINT payment_one_booking CHECK (num_nonnulls("bookingId", "sessionBookingId") = 1);

ALTER TABLE "OfferingSession"
  ADD CONSTRAINT session_valid_range CHECK ("endsAt" > "startsAt"),
  ADD CONSTRAINT session_positive_capacity CHECK (capacity > 0);

ALTER TABLE "SessionBooking"
  ADD CONSTRAINT session_booking_positive_seats CHECK (seats > 0);

ALTER TABLE "Offering"
  ADD CONSTRAINT offering_positive_duration CHECK ("durationMinutes" > 0),
  ADD CONSTRAINT offering_positive_group CHECK ("maxGuests" > 0);

-- The database itself refuses to sell more seats than a session has.
-- Every insert or update that holds seats (HELD or CONFIRMED) first locks the session row, so concurrent
-- requests for the last seats queue here and exactly the ones that fit get in. Code maps SQLSTATE 23P01
-- (the same code as the room overlap constraint) to "those seats were just taken".
CREATE FUNCTION session_seats_guard() RETURNS trigger AS $$
DECLARE
  session_capacity INT;
  taken INT;
BEGIN
  IF NEW.status NOT IN ('HELD', 'CONFIRMED') THEN
    RETURN NEW;
  END IF;
  SELECT capacity INTO session_capacity FROM "OfferingSession" WHERE id = NEW."sessionId" FOR UPDATE;
  SELECT COALESCE(SUM(seats), 0) INTO taken
    FROM "SessionBooking"
    WHERE "sessionId" = NEW."sessionId" AND status IN ('HELD', 'CONFIRMED') AND id <> NEW.id;
  IF taken + NEW.seats > session_capacity THEN
    RAISE EXCEPTION 'session % has % of % seats taken; % more do not fit', NEW."sessionId", taken, session_capacity, NEW.seats
      USING ERRCODE = '23P01';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER session_seats_guard
  BEFORE INSERT OR UPDATE OF seats, status, "sessionId" ON "SessionBooking"
  FOR EACH ROW EXECUTE FUNCTION session_seats_guard();

-- Lowering a session's capacity below what is already sold is refused too.
CREATE FUNCTION session_capacity_guard() RETURNS trigger AS $$
DECLARE
  taken INT;
BEGIN
  SELECT COALESCE(SUM(seats), 0) INTO taken
    FROM "SessionBooking" WHERE "sessionId" = NEW.id AND status IN ('HELD', 'CONFIRMED');
  IF taken > NEW.capacity THEN
    RAISE EXCEPTION 'session % already has % seats taken', NEW.id, taken USING ERRCODE = '23P01';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER session_capacity_guard
  BEFORE UPDATE OF capacity ON "OfferingSession"
  FOR EACH ROW EXECUTE FUNCTION session_capacity_guard();
