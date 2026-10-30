-- Places booked as a whole, and photos tagged by the part of the place they show.

-- CreateEnum
CREATE TYPE "BookingUnit" AS ENUM ('ROOMS', 'WHOLE_PLACE');

-- CreateEnum
CREATE TYPE "RoomKind" AS ENUM ('ROOM', 'WHOLE_PLACE');

-- CreateEnum
CREATE TYPE "PhotoArea" AS ENUM ('LIVING_ROOM', 'KITCHEN', 'DINING', 'BEDROOM', 'BATHROOM', 'EXTERIOR', 'TERRACE', 'GARDEN', 'POOL', 'VIEW', 'OTHER');

-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "bookingUnit" "BookingUnit" NOT NULL DEFAULT 'ROOMS';

-- AlterTable
ALTER TABLE "Photo" ADD COLUMN     "area" "PhotoArea";

-- AlterTable
ALTER TABLE "Room" ADD COLUMN     "kind" "RoomKind" NOT NULL DEFAULT 'ROOM';

-- A place has at most one whole-place unit.
CREATE UNIQUE INDEX room_one_whole_place ON "Room"("businessId") WHERE kind = 'WHOLE_PLACE';
