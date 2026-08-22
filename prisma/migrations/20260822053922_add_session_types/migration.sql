-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'session_type_created';
ALTER TYPE "AuditAction" ADD VALUE 'session_type_updated';
ALTER TYPE "AuditAction" ADD VALUE 'session_type_deleted';

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "sessionTypeId" TEXT,
ADD COLUMN     "sessionTypeName" TEXT;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "defaultSessionTypeId" TEXT;

-- CreateTable
CREATE TABLE "SessionType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessionType_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SessionType_name_key" ON "SessionType"("name");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_defaultSessionTypeId_fkey" FOREIGN KEY ("defaultSessionTypeId") REFERENCES "SessionType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_sessionTypeId_fkey" FOREIGN KEY ("sessionTypeId") REFERENCES "SessionType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
