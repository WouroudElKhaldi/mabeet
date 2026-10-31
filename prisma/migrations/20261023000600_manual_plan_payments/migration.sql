-- Paying for a plan by hand: Tafaddal's payment details, and hosts' requests with a receipt.
ALTER TYPE "PaymentMethod" ADD VALUE 'CRYPTO';

CREATE TYPE "PlanRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

CREATE TABLE "PlatformPaymentOption" (
    "id" TEXT NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "label" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PlatformPaymentOption_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlanRequest" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "requestedById" TEXT,
    "plan" "Plan" NOT NULL,
    "months" INTEGER NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "method" "PaymentMethod" NOT NULL,
    "payerReference" TEXT,
    "note" TEXT,
    "receiptMime" TEXT NOT NULL,
    "receiptBytes" BYTEA NOT NULL,
    "status" "PlanRequestStatus" NOT NULL DEFAULT 'PENDING',
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlanRequest_pkey" PRIMARY KEY ("id"),
    -- A paid plan, for 1 to 12 months, at a positive price; a decided request says who and when.
    CONSTRAINT "plan_request_paid_plan" CHECK ("plan" <> 'FREE'),
    CONSTRAINT "plan_request_months" CHECK ("months" BETWEEN 1 AND 12),
    CONSTRAINT "plan_request_positive_amount" CHECK ("amountCents" > 0),
    CONSTRAINT "plan_request_decided" CHECK (
        ("status" IN ('APPROVED', 'REJECTED')) = ("decidedAt" IS NOT NULL AND "decidedById" IS NOT NULL)
    )
);

CREATE INDEX "PlanRequest_status_createdAt_idx" ON "PlanRequest"("status", "createdAt");
CREATE INDEX "PlanRequest_businessId_createdAt_idx" ON "PlanRequest"("businessId", "createdAt");
-- One waiting request per business: a second one while the first is undecided is refused by the database.
CREATE UNIQUE INDEX "plan_request_one_pending" ON "PlanRequest"("businessId") WHERE "status" = 'PENDING';

ALTER TABLE "PlanRequest" ADD CONSTRAINT "PlanRequest_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlanRequest" ADD CONSTRAINT "PlanRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
