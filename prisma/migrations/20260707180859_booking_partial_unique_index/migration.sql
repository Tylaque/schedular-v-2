-- DropIndex
DROP INDEX "Booking_projectId_dateKey_time_status_key";

-- Create partial unique index: only one confirmed booking per slot (capacity=1 guard).
-- For sessionCapacity > 1, the application logic in createBooking() enforces the limit
-- by counting confirmed bookings before insert, inside a serializable transaction.
-- If both protections are ever changed, they must be updated together.
CREATE UNIQUE INDEX "Booking_project_slot_confirmed_unique"
ON "Booking" ("projectId", "dateKey", "time")
WHERE "status" = 'confirmed';
