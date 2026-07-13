ALTER TABLE "Booking" ADD COLUMN "rescheduledFromId" TEXT;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_rescheduledFromId_key" UNIQUE ("rescheduledFromId");
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_rescheduledFrom_fkey" FOREIGN KEY ("rescheduledFromId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
