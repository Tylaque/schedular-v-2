-- CreateEnum
CREATE TYPE "AssignmentMode" AS ENUM ('AUTO', 'PARTICIPANT_CHOICE');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "assignmentMode" "AssignmentMode" NOT NULL DEFAULT 'AUTO';
