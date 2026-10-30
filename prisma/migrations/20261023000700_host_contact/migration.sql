-- CreateEnum
CREATE TYPE "HostContact" AS ENUM ('WHATSAPP', 'MESSAGE', 'BOTH');

-- AlterTable
ALTER TABLE "HostProfile" ADD COLUMN "contactBy" "HostContact" NOT NULL DEFAULT 'BOTH';
