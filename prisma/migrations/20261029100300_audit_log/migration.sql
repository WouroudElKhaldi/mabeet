-- The business and admin bells and the admin audit trail move to their own table, AuditLog. ActivityLog stays
-- each person's own timeline. Business and platform events logged so far are copied over, so the bells keep
-- their history; nothing is removed from ActivityLog.

-- DropForeignKey
ALTER TABLE "ActivityLog" DROP CONSTRAINT "ActivityLog_userId_fkey";

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "businessId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "meta" JSONB,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditLog_businessId_createdAt_idx" ON "AuditLog"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


INSERT INTO "AuditLog" ("id", "actorId", "businessId", "action", "entity", "entityId", "meta", "isDeleted", "createdAt")
SELECT "id", "userId", "businessId", "action", "entity", "entityId", "meta", "isDeleted", "createdAt"
FROM "ActivityLog"
WHERE "businessId" IS NOT NULL OR "action" LIKE 'platform.%';

-- Team, system and platform events now live in AuditLog only. Their old rows stay in ActivityLog, marked deleted,
-- so a host's own timeline never reads their decisions as things that happened to them.
UPDATE "ActivityLog" SET "isDeleted" = true
WHERE "action" NOT IN (
  'booking.requested', 'booking.cancelled_by_guest', 'favorite.added', 'favorite.removed', 'review.submitted',
  'member.invitation_accepted'
);
