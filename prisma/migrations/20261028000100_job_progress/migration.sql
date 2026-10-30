-- CreateTable
CREATE TABLE "JobProgress" (
    "jobId" TEXT NOT NULL,
    "step" TEXT,
    "text" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobProgress_pkey" PRIMARY KEY ("jobId")
);

-- CreateIndex
CREATE INDEX "JobProgress_updatedAt_idx" ON "JobProgress"("updatedAt");
