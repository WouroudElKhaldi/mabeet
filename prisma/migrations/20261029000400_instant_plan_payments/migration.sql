-- Plans are paid instantly only: by card through Stripe, or through Whish. Hand payments that waited for an
-- admin's approval (PlanRequest) and the list of ways to pay by hand (PlatformPaymentOption) are gone.
-- PlanPayment takes over the two PlanRequest columns still worth keeping: who paid and for how many months.

ALTER TABLE "PlanPayment"
  ADD COLUMN "paidById" TEXT,
  ADD COLUMN "months" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "PlanPayment" ADD CONSTRAINT "PlanPayment_paidById_fkey"
  FOREIGN KEY ("paidById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Approved hand payments already became PlanPayment rows, tagged "manual:<request id>". Keep who paid and the
-- months on them, so that history survives the request table.
UPDATE "PlanPayment" p
SET "paidById" = r."requestedById", "months" = r."months"
FROM "PlanRequest" r
WHERE p."providerRef" = 'manual:' || r.id;

-- From now on a plan payment is Stripe or Whish. NOT VALID: the old hand-paid rows stay as they were.
ALTER TABLE "PlanPayment" ADD CONSTRAINT plan_payment_instant_only
  CHECK (method IN ('STRIPE', 'WHISH')) NOT VALID;

DROP TABLE "PlanRequest";
DROP TYPE "PlanRequestStatus";
DROP TABLE "PlatformPaymentOption";
