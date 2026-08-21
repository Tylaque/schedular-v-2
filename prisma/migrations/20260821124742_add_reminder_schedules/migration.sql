-- AlterEnum
ALTER TYPE "EmailCategory" ADD VALUE 'reminder';

-- AlterTable
ALTER TABLE "NotificationLog" ADD COLUMN     "hoursBefore" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "ReminderSchedule" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "hoursBefore" DOUBLE PRECISION NOT NULL,
    "label" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReminderSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReminderSchedule_projectId_hoursBefore_key" ON "ReminderSchedule"("projectId", "hoursBefore");

-- AddForeignKey
ALTER TABLE "ReminderSchedule" ADD CONSTRAINT "ReminderSchedule_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
