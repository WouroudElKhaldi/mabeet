-- Reviews of experiences and services: a review now belongs to a stay or to a session booking.
ALTER TABLE "Review" ALTER COLUMN "roomId" DROP NOT NULL,
ALTER COLUMN "bookingId" DROP NOT NULL,
ADD COLUMN "offeringId" TEXT,
ADD COLUMN "sessionBookingId" TEXT;

CREATE UNIQUE INDEX "Review_sessionBookingId_key" ON "Review"("sessionBookingId");
CREATE INDEX "Review_offeringId_status_idx" ON "Review"("offeringId", "status");

ALTER TABLE "Review" ADD CONSTRAINT "Review_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "Offering"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Review" ADD CONSTRAINT "Review_sessionBookingId_fkey" FOREIGN KEY ("sessionBookingId") REFERENCES "SessionBooking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Exactly one of: a stay (room and booking), or a session (offering and session booking).
ALTER TABLE "Review" ADD CONSTRAINT "review_one_booking" CHECK (
  ("bookingId" IS NOT NULL AND "roomId" IS NOT NULL AND "sessionBookingId" IS NULL AND "offeringId" IS NULL)
  OR ("bookingId" IS NULL AND "roomId" IS NULL AND "sessionBookingId" IS NOT NULL AND "offeringId" IS NOT NULL)
);
