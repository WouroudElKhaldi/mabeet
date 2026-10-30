-- The new project's booking rules (docs/team/07-data-model.md, section 2): one booking mode with three values
-- instead of bookingMode + paymentCollection, no refund policies (every refund of an online payment is full and
-- automatic), payments online only, and no Kazderni. Existing rows are carried over before the old columns go.

-- 1. The three modes. A business that collected online keeps collecting online: instant booking becomes
--    AUTOMATIC, a request becomes ONLINE_APPROVAL. Paying at the place becomes OFFLINE.
CREATE TYPE "BookingMode_new" AS ENUM ('AUTOMATIC', 'ONLINE_APPROVAL', 'OFFLINE');

ALTER TABLE "Business" ALTER COLUMN "bookingMode" DROP DEFAULT;
ALTER TABLE "Business" ALTER COLUMN "bookingMode" TYPE "BookingMode_new" USING (
  CASE
    WHEN "paymentCollection" = 'AT_PLACE' THEN 'OFFLINE'
    WHEN "bookingMode" = 'INSTANT' THEN 'AUTOMATIC'
    ELSE 'ONLINE_APPROVAL'
  END
)::"BookingMode_new";
ALTER TABLE "Business" ALTER COLUMN "bookingMode" SET DEFAULT 'OFFLINE';
DROP TYPE "BookingMode";
ALTER TYPE "BookingMode_new" RENAME TO "BookingMode";

-- When the owner accepted "online payments are always refunded in full". Businesses already collecting online
-- accepted the online payment policy when they chose it.
ALTER TABLE "Business" ADD COLUMN "onlineTermsAcceptedAt" TIMESTAMP(3);
UPDATE "Business" SET "onlineTermsAcceptedAt" = "updatedAt" WHERE "paymentCollection" = 'ONLINE';

ALTER TABLE "Business" DROP COLUMN "paymentCollection";
ALTER TABLE "Business" DROP COLUMN "refundPolicy";
DROP TYPE "PaymentCollection";

-- 2. Each booking keeps the mode it was made in, so a later change of the business's mode never affects it. A
--    booking with an online amount was paid online; the amount is now always totalCents.
ALTER TABLE "Booking" ADD COLUMN "bookingMode" "BookingMode";
UPDATE "Booking" AS booking
SET "bookingMode" = CASE
  WHEN booking."onlineDueCents" IS NULL THEN 'OFFLINE'
  WHEN business."bookingMode" = 'AUTOMATIC' THEN 'AUTOMATIC'
  ELSE 'ONLINE_APPROVAL'
END::"BookingMode"
FROM "Business" AS business
WHERE business.id = booking."businessId";
ALTER TABLE "Booking" ALTER COLUMN "bookingMode" SET NOT NULL;
ALTER TABLE "Booking" DROP COLUMN "onlineDueCents";
ALTER TABLE "Booking" DROP COLUMN "refundPolicy";

ALTER TABLE "SessionBooking" ADD COLUMN "bookingMode" "BookingMode";
UPDATE "SessionBooking" AS booking
SET "bookingMode" = CASE
  WHEN booking."onlineDueCents" IS NULL THEN 'OFFLINE'
  WHEN business."bookingMode" = 'AUTOMATIC' THEN 'AUTOMATIC'
  ELSE 'ONLINE_APPROVAL'
END::"BookingMode"
FROM "Business" AS business
WHERE business.id = booking."businessId";
ALTER TABLE "SessionBooking" ALTER COLUMN "bookingMode" SET NOT NULL;
ALTER TABLE "SessionBooking" DROP COLUMN "onlineDueCents";
ALTER TABLE "SessionBooking" DROP COLUMN "refundPolicy";

DROP TYPE "RefundPolicy";

-- 3. Payment rows only come from Whish or Stripe now, so there is nobody who "recorded" one and nothing to flag as
--    online. Rows recorded by hand before this stay (nothing is deleted) with their method.
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_recordedById_fkey";
ALTER TABLE "Payment" DROP COLUMN "recordedById";
ALTER TABLE "Payment" DROP COLUMN "online";

-- 4. No Kazderni (no API and no calendar link): its links become OTHER. Closed dates keep only their note, and
--    imported nights take their source from their CalendarFeed.
ALTER TABLE "Occupancy" DROP COLUMN "source";

CREATE TYPE "FeedSource_new" AS ENUM ('AIRBNB', 'BOOKING', 'OTHER');
ALTER TABLE "CalendarFeed" ALTER COLUMN "source" TYPE "FeedSource_new" USING (
  CASE WHEN "source" = 'KAZDERNI' THEN 'OTHER' ELSE "source"::text END
)::"FeedSource_new";
DROP TYPE "FeedSource";
ALTER TYPE "FeedSource_new" RENAME TO "FeedSource";
