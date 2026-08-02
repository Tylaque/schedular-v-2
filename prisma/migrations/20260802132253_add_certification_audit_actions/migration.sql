-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'certification_created';
ALTER TYPE "AuditAction" ADD VALUE 'certification_updated';
ALTER TYPE "AuditAction" ADD VALUE 'certification_deleted';
ALTER TYPE "AuditAction" ADD VALUE 'admin_certifications_set';
ALTER TYPE "AuditAction" ADD VALUE 'project_certification_requirements_set';
