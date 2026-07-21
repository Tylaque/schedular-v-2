-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "selfServiceWindowHours" INTEGER NOT NULL DEFAULT 4;

-- RenameForeignKey
ALTER TABLE "Booking" RENAME CONSTRAINT "Booking_rescheduledFrom_fkey" TO "Booking_rescheduledFromId_fkey";
