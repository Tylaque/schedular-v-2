-- CreateEnum
CREATE TYPE "MeetingPlatform" AS ENUM ('zoom', 'teams');

-- CreateEnum
CREATE TYPE "MeetingPlatformPreference" AS ENUM ('zoom', 'teams', 'auto');

-- CreateEnum
CREATE TYPE "ZoomProvisionStatus" AS ENUM ('pending', 'provisioned', 'failed');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'zoom_fallback_to_teams';
ALTER TYPE "AuditAction" ADD VALUE 'zoom_pool_full_no_fallback';
ALTER TYPE "AuditAction" ADD VALUE 'zoom_provision_failed';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EmailCategory" ADD VALUE 'zoom_fallback_to_teams';
ALTER TYPE "EmailCategory" ADD VALUE 'zoom_pool_full_no_fallback';

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "meetingFallbackReason" TEXT,
ADD COLUMN     "meetingPlatform" "MeetingPlatform",
ADD COLUMN     "zoomAccountId" TEXT,
ADD COLUMN     "zoomErrorDetail" TEXT,
ADD COLUMN     "zoomJoinUrl" TEXT,
ADD COLUMN     "zoomMeetingId" TEXT,
ADD COLUMN     "zoomProvisionStatus" "ZoomProvisionStatus";

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "meetingPlatformPreference" "MeetingPlatformPreference" NOT NULL DEFAULT 'auto';

-- CreateTable
CREATE TABLE "ZoomAccount" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "zoomUserId" TEXT NOT NULL,
    "zoomEmail" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ZoomAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ZoomAccount_zoomUserId_key" ON "ZoomAccount"("zoomUserId");

-- CreateIndex
CREATE UNIQUE INDEX "ZoomAccount_zoomEmail_key" ON "ZoomAccount"("zoomEmail");

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_zoomAccountId_fkey" FOREIGN KEY ("zoomAccountId") REFERENCES "ZoomAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
