-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'booking_completed';

-- AlterEnum
ALTER TYPE "BookingStatus" ADD VALUE 'completed';

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "autoCompleteBookings" BOOLEAN NOT NULL DEFAULT false;
