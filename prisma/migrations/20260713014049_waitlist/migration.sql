-- CreateEnum
CREATE TYPE "WaitlistStatus" AS ENUM ('waiting', 'offered', 'expired', 'claimed', 'cancelled');

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'waitlist_joined';

-- AlterEnum
ALTER TYPE "ParticipantStatus" ADD VALUE 'waitlisted';

-- CreateTable
CREATE TABLE "WaitlistEntry" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "dateKey" TEXT,
    "time" TEXT,
    "status" "WaitlistStatus" NOT NULL DEFAULT 'waiting',
    "offeredAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "claimedBookingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WaitlistEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WaitlistEntry_projectId_status_createdAt_idx" ON "WaitlistEntry"("projectId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "WaitlistEntry_projectId_dateKey_time_status_idx" ON "WaitlistEntry"("projectId", "dateKey", "time", "status");

-- AddForeignKey
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
