-- No more deposits: every booking is paid in full, online through Tafaddal or to the host directly.
-- The host's payment instructions are kept under their new name. Bookings made before this keep the
-- online amount they were sold with (onlineDueCents), so nobody is charged differently mid-payment.

ALTER TABLE "Business" RENAME COLUMN "depositInstructions" TO "paymentInstructions";
ALTER TABLE "Business" DROP COLUMN "depositPercent";
ALTER TABLE "Business" DROP COLUMN "onlineAmount";
DROP TYPE "OnlineAmount";

ALTER TABLE "Booking" DROP COLUMN "depositCents";
ALTER TABLE "SessionBooking" DROP COLUMN "depositCents";
