-- CreateEnum
CREATE TYPE "SessionTypeClassification" AS ENUM ('STANDARD', 'FEEDBACK');

-- AlterTable: add classification with safe default for all existing rows
ALTER TABLE "SessionType" ADD COLUMN "classification" "SessionTypeClassification" NOT NULL DEFAULT 'STANDARD';
