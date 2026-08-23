-- AlterEnum
ALTER TYPE "EmailCategory" ADD VALUE 'integration_failure';

-- AlterTable
ALTER TABLE "NotificationLog" ADD COLUMN "dedupKey" TEXT;

-- CreateIndex
CREATE INDEX "NotificationLog_dedupKey_createdAt_idx" ON "NotificationLog"("dedupKey", "createdAt");
