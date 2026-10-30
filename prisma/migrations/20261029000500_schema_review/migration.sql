-- Schema review: one source of truth per fact, the indexes searches and jobs need, and rate limits in Redis.

-- 1. Cancellation: the refund policy enum decides refunds, so it is the only rule shown to guests. The host's
--    free text and an experience's "free cancellation up to N hours" could contradict it, and are gone.
ALTER TABLE "Business" DROP COLUMN "cancellationPolicy";
ALTER TABLE "Offering" DROP COLUMN "cancellationHours";

-- 2. Contact numbers: a place's WhatsApp and phone are the guest contact; User.phone is the host's own. The host
--    profile's copies are moved there first (only where the target is empty), then dropped.
UPDATE "User" u
SET phone = hp.phone
FROM "HostProfile" hp
WHERE hp."userId" = u.id AND u.phone IS NULL AND hp.phone IS NOT NULL;

UPDATE "Business" b
SET whatsapp = hp.whatsapp
FROM "HostProfile" hp
JOIN "Membership" m ON m."userId" = hp."userId" AND m.status = 'ACTIVE'
JOIN "Role" r ON r.id = m."roleId" AND r."isOwner"
WHERE m."businessId" = b.id AND b.whatsapp IS NULL AND hp.whatsapp IS NOT NULL;

ALTER TABLE "HostProfile" DROP COLUMN "phone", DROP COLUMN "whatsapp";

-- 3. Reviews: only the overall rating is shown anywhere.
ALTER TABLE "Review" DROP COLUMN "cleanliness", DROP COLUMN "location", DROP COLUMN "value";

-- 4. Push devices: guests need an account, so every device belongs to a signed-in person, and one browser
--    endpoint is one device. Rows kept only for a booking link can no longer be reached and are removed.
DELETE FROM "PushSubscription" WHERE "userId" IS NULL;
DELETE FROM "PushSubscription" p
USING "PushSubscription" newer
WHERE p.endpoint = newer.endpoint
  AND (p."createdAt", p.id) < (newer."createdAt", newer.id);
DROP INDEX "PushSubscription_bookingToken_idx";
DROP INDEX "PushSubscription_endpoint_idx";
ALTER TABLE "PushSubscription" DROP COLUMN "bookingToken";
ALTER TABLE "PushSubscription" ALTER COLUMN "userId" SET NOT NULL;
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- 5. Indexes. Array filters (tags, accessibility, amenities) use GIN; the hold-expiry jobs look up by status and
--    deadline; booking lists and session searches go by date.
CREATE INDEX "Business_tags_idx" ON "Business" USING GIN ("tags");
CREATE INDEX "Business_accessibility_idx" ON "Business" USING GIN ("accessibility");
CREATE INDEX "Offering_tags_idx" ON "Offering" USING GIN ("tags");
CREATE INDEX "Offering_accessibility_idx" ON "Offering" USING GIN ("accessibility");
CREATE INDEX "Room_amenities_idx" ON "Room" USING GIN ("amenities");
CREATE INDEX "Booking_businessId_checkIn_idx" ON "Booking"("businessId", "checkIn");
CREATE INDEX "Booking_status_holdExpiresAt_idx" ON "Booking"("status", "holdExpiresAt");
CREATE INDEX "SessionBooking_status_holdExpiresAt_idx" ON "SessionBooking"("status", "holdExpiresAt");
DROP INDEX "OfferingSession_businessId_idx";
CREATE INDEX "OfferingSession_businessId_startsAt_idx" ON "OfferingSession"("businessId", "startsAt");

-- 6. Rate-limit counters live in Redis now, where they expire by themselves.
DROP TABLE "RateLimitWindow";
