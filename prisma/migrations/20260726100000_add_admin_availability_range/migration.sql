-- CreateTable
CREATE TABLE "AdminAvailabilityRange" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "dateKey" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminAvailabilityRange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminAvailabilityRange_adminId_dateKey_idx" ON "AdminAvailabilityRange"("adminId", "dateKey");

-- AddForeignKey
ALTER TABLE "AdminAvailabilityRange" ADD CONSTRAINT "AdminAvailabilityRange_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;
