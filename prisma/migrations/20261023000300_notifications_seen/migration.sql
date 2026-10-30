-- When each person last opened their notifications, for the unread count on the bell.

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "notificationsSeenAt" TIMESTAMP(3);
