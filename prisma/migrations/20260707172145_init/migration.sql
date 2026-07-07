-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('draft', 'active', 'paused', 'closed', 'archived');

-- CreateEnum
CREATE TYPE "ParticipantStatus" AS ENUM ('invited', 'link_sent', 'booked', 'reminded', 'completed', 'no_show', 'cancelled');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('confirmed', 'cancelled', 'rescheduled');

-- CreateTable
CREATE TABLE "Admin" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "initials" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "availabilityPeriodDays" INTEGER NOT NULL,
    "dailyStart" TEXT NOT NULL,
    "dailyEnd" TEXT NOT NULL,
    "includeWeekends" BOOLEAN NOT NULL DEFAULT false,
    "minNoticeHours" INTEGER NOT NULL,
    "timezone" TEXT NOT NULL,
    "bookingDeadlineDays" INTEGER NOT NULL,
    "bufferMinutes" INTEGER NOT NULL,
    "maxSessionsPerAdminPerDay" INTEGER NOT NULL,
    "sessionCapacity" INTEGER NOT NULL DEFAULT 1,
    "status" "ProjectStatus" NOT NULL DEFAULT 'draft',
    "availabilityLockDate" TIMESTAMP(3) NOT NULL,
    "brandingLogoInitial" TEXT NOT NULL,
    "brandingPrimaryColor" TEXT NOT NULL,
    "brandingSenderName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectAdmin" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectAdmin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminAvailability" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "dateKey" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Participant" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "customFields" JSONB,
    "status" "ParticipantStatus" NOT NULL DEFAULT 'invited',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Participant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "participantName" TEXT NOT NULL,
    "participantEmail" TEXT NOT NULL,
    "dateKey" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'confirmed',
    "teamsMeetingId" TEXT,
    "calendarEventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Admin_email_key" ON "Admin"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Project_slug_key" ON "Project"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectAdmin_projectId_adminId_key" ON "ProjectAdmin"("projectId", "adminId");

-- CreateIndex
CREATE INDEX "AdminAvailability_projectId_dateKey_idx" ON "AdminAvailability"("projectId", "dateKey");

-- CreateIndex
CREATE UNIQUE INDEX "AdminAvailability_projectId_adminId_dateKey_time_key" ON "AdminAvailability"("projectId", "adminId", "dateKey", "time");

-- CreateIndex
CREATE UNIQUE INDEX "Participant_projectId_email_key" ON "Participant"("projectId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_projectId_dateKey_time_status_key" ON "Booking"("projectId", "dateKey", "time", "status");

-- AddForeignKey
ALTER TABLE "ProjectAdmin" ADD CONSTRAINT "ProjectAdmin_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectAdmin" ADD CONSTRAINT "ProjectAdmin_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminAvailability" ADD CONSTRAINT "AdminAvailability_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminAvailability" ADD CONSTRAINT "AdminAvailability_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Participant" ADD CONSTRAINT "Participant_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;
