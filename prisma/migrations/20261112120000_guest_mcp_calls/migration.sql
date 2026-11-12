-- A call to the public guest MCP has no place: it is logged with no business, so the platform can count every AI call.
ALTER TABLE "McpAuditLog" ALTER COLUMN "businessId" DROP NOT NULL;

-- The platform's AI usage page counts calls over a period across every place.
CREATE INDEX "McpAuditLog_createdAt_idx" ON "McpAuditLog"("createdAt");
