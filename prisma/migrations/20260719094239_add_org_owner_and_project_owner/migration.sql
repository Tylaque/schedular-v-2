-- AlterEnum
ALTER TYPE "AdminRole" ADD VALUE 'org_owner';

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "ownerId" TEXT;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
