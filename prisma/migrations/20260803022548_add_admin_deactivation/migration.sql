-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'admin_deactivated';
ALTER TYPE "AuditAction" ADD VALUE 'admin_reactivated';

-- AlterTable
ALTER TABLE "Admin" ADD COLUMN     "deactivatedAt" TIMESTAMP(3),
ADD COLUMN     "deactivatedBy" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;
