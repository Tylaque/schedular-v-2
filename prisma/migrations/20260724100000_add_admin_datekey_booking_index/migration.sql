-- CreateIndex
CREATE INDEX IF NOT EXISTS "Booking_adminId_dateKey_idx" ON "Booking"("adminId", "dateKey");
