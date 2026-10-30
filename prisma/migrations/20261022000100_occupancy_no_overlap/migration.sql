-- The database itself refuses double bookings.
-- Prisma's schema language cannot express EXCLUDE constraints, so they live in this hand-written migration.
-- tests/integration/occupancy-constraint.test.ts fails if a later migration drops them.

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Occupancy"
  ADD CONSTRAINT occupancy_valid_range CHECK ("checkOut" > "checkIn");

-- Same room, active, not imported: no two night ranges may overlap.
-- '[)' counts nights: a guest leaving on the 12th never clashes with one arriving on the 12th.
-- Imported platform events are excluded because Airbnb and Booking.com may legitimately overlap each other;
-- direct bookings are checked against them in code, under a row lock on the room.
ALTER TABLE "Occupancy"
  ADD CONSTRAINT occupancy_no_overlap
  EXCLUDE USING gist (
    "roomId" WITH =,
    daterange("checkIn", "checkOut", '[)') WITH &&
  )
  WHERE (active AND kind <> 'IMPORTED');

ALTER TABLE "Booking"
  ADD CONSTRAINT booking_valid_range CHECK ("checkOut" > "checkIn"),
  ADD CONSTRAINT booking_positive_guests CHECK ("guestCount" > 0);

ALTER TABLE "Review"
  ADD CONSTRAINT review_rating_range CHECK (rating BETWEEN 1 AND 5);
