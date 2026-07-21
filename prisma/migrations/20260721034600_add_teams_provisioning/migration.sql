-- CreateEnum
CREATE TYPE "TeamsProvisionStatus" AS ENUM ('pending', 'provisioned', 'failed_personal_account', 'failed_insufficient_permissions', 'failed_unknown');

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN "teamsProvisionStatus" "TeamsProvisionStatus",
ADD COLUMN "teamsJoinUrl" TEXT,
ADD COLUMN "teamsErrorDetail" TEXT;
