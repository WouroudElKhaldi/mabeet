-- Money moves from 32-bit INTEGER to BIGINT minor units. A 32-bit column tops out near 21 million in
-- whole currency units, which an LBP stay of a few nights already passes. Widening keeps every value.

ALTER TABLE "Room" ALTER COLUMN "baseRateCents" SET DATA TYPE BIGINT;
ALTER TABLE "RateOverride" ALTER COLUMN "rateCents" SET DATA TYPE BIGINT;

ALTER TABLE "Booking"
  ALTER COLUMN "totalCents" SET DATA TYPE BIGINT,
  ALTER COLUMN "onlineDueCents" SET DATA TYPE BIGINT;

ALTER TABLE "SessionBooking"
  ALTER COLUMN "totalCents" SET DATA TYPE BIGINT,
  ALTER COLUMN "onlineDueCents" SET DATA TYPE BIGINT;

ALTER TABLE "Offering" ALTER COLUMN "priceCents" SET DATA TYPE BIGINT;

ALTER TABLE "Payment"
  ALTER COLUMN "amountCents" SET DATA TYPE BIGINT,
  ALTER COLUMN "refundedCents" SET DATA TYPE BIGINT;

ALTER TABLE "Refund" ALTER COLUMN "amountCents" SET DATA TYPE BIGINT;
ALTER TABLE "Payout" ALTER COLUMN "amountCents" SET DATA TYPE BIGINT;
ALTER TABLE "PlanPayment" ALTER COLUMN "amountCents" SET DATA TYPE BIGINT;
ALTER TABLE "PlanRequest" ALTER COLUMN "amountCents" SET DATA TYPE BIGINT;

ALTER TABLE "AiUsage" ALTER COLUMN "costMicroUsd" SET DATA TYPE BIGINT;
