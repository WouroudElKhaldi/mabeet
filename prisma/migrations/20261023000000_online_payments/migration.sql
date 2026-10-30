-- Online payments through Mabeet (Whish and Stripe), instant booking, refunds, payouts to hosts and plan revenue.

-- CreateEnum
CREATE TYPE "BookingMode" AS ENUM ('REQUEST', 'INSTANT');

-- CreateEnum
CREATE TYPE "PaymentCollection" AS ENUM ('AT_PLACE', 'ONLINE');

-- CreateEnum
CREATE TYPE "OnlineAmount" AS ENUM ('DEPOSIT', 'FULL');

-- CreateEnum
CREATE TYPE "RefundPolicy" AS ENUM ('FLEXIBLE', 'MODERATE', 'STRICT', 'NON_REFUNDABLE');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('PENDING', 'DONE');

-- CreateEnum
CREATE TYPE "PayoutMethod" AS ENUM ('BANK_TRANSFER', 'WHISH');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('REQUESTED', 'PAID', 'REJECTED');

-- AlterEnum
ALTER TYPE "BookingStatus" ADD VALUE 'AWAITING_PAYMENT';

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "onlineDueCents" INTEGER,
ADD COLUMN     "refundPolicy" "RefundPolicy" NOT NULL DEFAULT 'FLEXIBLE';

-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "bookingMode" "BookingMode" NOT NULL DEFAULT 'REQUEST',
ADD COLUMN     "onlineAmount" "OnlineAmount" NOT NULL DEFAULT 'DEPOSIT',
ADD COLUMN     "paymentCollection" "PaymentCollection" NOT NULL DEFAULT 'AT_PLACE',
ADD COLUMN     "refundPolicy" "RefundPolicy" NOT NULL DEFAULT 'FLEXIBLE';

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "checkoutUrl" TEXT,
ADD COLUMN     "online" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "providerPaymentId" TEXT,
ADD COLUMN     "refundedCents" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "SessionBooking" ADD COLUMN     "onlineDueCents" INTEGER,
ADD COLUMN     "refundPolicy" "RefundPolicy" NOT NULL DEFAULT 'FLEXIBLE';

-- CreateTable
CREATE TABLE "Refund" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "status" "RefundStatus" NOT NULL,
    "reason" TEXT NOT NULL,
    "providerRef" TEXT,
    "doneAt" TIMESTAMP(3),
    "doneById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payout" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "method" "PayoutMethod" NOT NULL,
    "accountName" TEXT NOT NULL,
    "bankName" TEXT,
    "iban" TEXT,
    "whishPhone" TEXT,
    "status" "PayoutStatus" NOT NULL DEFAULT 'REQUESTED',
    "requestedById" TEXT NOT NULL,
    "reference" TEXT,
    "adminNote" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanPayment" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "plan" "Plan" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentStatus" NOT NULL,
    "providerRef" TEXT NOT NULL,
    "checkoutUrl" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhishSandboxPayment" (
    "externalId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "invoice" TEXT,
    "successCallbackUrl" TEXT NOT NULL,
    "failureCallbackUrl" TEXT NOT NULL,
    "successRedirectUrl" TEXT NOT NULL,
    "failureRedirectUrl" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "payerPhone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhishSandboxPayment_pkey" PRIMARY KEY ("externalId")
);

-- CreateIndex
CREATE INDEX "Refund_businessId_idx" ON "Refund"("businessId");

-- CreateIndex
CREATE INDEX "Refund_status_idx" ON "Refund"("status");

-- CreateIndex
CREATE INDEX "Payout_businessId_idx" ON "Payout"("businessId");

-- CreateIndex
CREATE INDEX "Payout_status_idx" ON "Payout"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PlanPayment_providerRef_key" ON "PlanPayment"("providerRef");

-- CreateIndex
CREATE INDEX "PlanPayment_businessId_idx" ON "PlanPayment"("businessId");

-- CreateIndex
CREATE INDEX "PlanPayment_status_paidAt_idx" ON "PlanPayment"("status", "paidAt");

-- CreateIndex
CREATE UNIQUE INDEX "WhishSandboxPayment_code_key" ON "WhishSandboxPayment"("code");

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanPayment" ADD CONSTRAINT "PlanPayment_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Money rules the database keeps itself (checked by tests/integration/money.test.ts).
ALTER TABLE "Payment"
  ADD CONSTRAINT payment_refund_within_amount CHECK ("refundedCents" BETWEEN 0 AND "amountCents");
ALTER TABLE "Refund" ADD CONSTRAINT refund_positive_amount CHECK ("amountCents" > 0);
ALTER TABLE "Payout" ADD CONSTRAINT payout_positive_amount CHECK ("amountCents" > 0);
ALTER TABLE "PlanPayment" ADD CONSTRAINT plan_payment_positive_amount CHECK ("amountCents" > 0);
ALTER TABLE "Payout" ADD CONSTRAINT payout_has_destination CHECK (
  (method = 'BANK_TRANSFER' AND iban IS NOT NULL) OR (method = 'WHISH' AND "whishPhone" IS NOT NULL)
);
