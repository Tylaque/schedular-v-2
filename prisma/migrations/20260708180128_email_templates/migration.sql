-- CreateEnum
CREATE TYPE "EmailCategory" AS ENUM ('admin_invitation', 'availability_request', 'participant_invitation', 'booking_confirmation', 'reminder_24h', 'reminder_1h', 'reschedule_notice', 'cancellation_notice', 'waitlist_offer');

-- CreateEnum
CREATE TYPE "EmailAudience" AS ENUM ('admin', 'participant', 'super_admin');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('sent', 'failed', 'test');

-- CreateTable
CREATE TABLE "EmailTemplate" (
    "id" TEXT NOT NULL,
    "category" "EmailCategory" NOT NULL,
    "audience" "EmailAudience" NOT NULL,
    "projectId" TEXT,
    "subject" TEXT NOT NULL,
    "bodyHtml" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL,
    "templateId" TEXT,
    "category" "EmailCategory" NOT NULL,
    "projectId" TEXT,
    "recipientEmail" TEXT NOT NULL,
    "recipientRole" "EmailAudience" NOT NULL,
    "subject" TEXT NOT NULL,
    "renderedBody" TEXT NOT NULL,
    "status" "NotificationStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailTemplate_category_projectId_isActive_idx" ON "EmailTemplate"("category", "projectId", "isActive");

-- AddForeignKey
ALTER TABLE "EmailTemplate" ADD CONSTRAINT "EmailTemplate_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "EmailTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
