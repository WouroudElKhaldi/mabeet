-- The language each guest booked in, so their emails are written in it.
ALTER TABLE "Booking" ADD COLUMN "locale" TEXT NOT NULL DEFAULT 'en';
ALTER TABLE "SessionBooking" ADD COLUMN "locale" TEXT NOT NULL DEFAULT 'en';
