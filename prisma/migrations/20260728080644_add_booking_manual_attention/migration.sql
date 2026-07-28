-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "manualAttentionReason" TEXT,
ADD COLUMN     "needsManualAttention" BOOLEAN NOT NULL DEFAULT false;
