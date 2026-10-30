-- Tokens and cost of each assistant answer, for the monthly AI budget.
CREATE TABLE "AiUsage" (
    "id" TEXT NOT NULL,
    "surface" TEXT NOT NULL,
    "businessId" TEXT,
    "promptTokens" INTEGER NOT NULL,
    "completionTokens" INTEGER NOT NULL,
    "costMicroUsd" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiUsage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AiUsage_createdAt_idx" ON "AiUsage"("createdAt");
