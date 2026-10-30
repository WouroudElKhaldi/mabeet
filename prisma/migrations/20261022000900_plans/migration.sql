-- Host plans, kept in sync with Stripe subscriptions.
CREATE TYPE "Plan" AS ENUM ('FREE', 'PRO', 'BUSINESS');

ALTER TABLE "Business" ADD COLUMN "plan" "Plan" NOT NULL DEFAULT 'FREE',
ADD COLUMN "stripeCustomerId" TEXT,
ADD COLUMN "stripeSubscriptionId" TEXT,
ADD COLUMN "planRenewsAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Business_stripeCustomerId_key" ON "Business"("stripeCustomerId");
CREATE UNIQUE INDEX "Business_stripeSubscriptionId_key" ON "Business"("stripeSubscriptionId");

-- Businesses that existed before plans keep everything they use today.
UPDATE "Business" SET "plan" = 'PRO';
