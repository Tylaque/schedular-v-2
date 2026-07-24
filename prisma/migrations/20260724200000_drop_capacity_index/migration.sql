-- Drop the blanket partial unique index that prevents sessionCapacity > 1.
-- The application-level count-check inside createBooking()'s serializable
-- transaction (existingCount vs sessionCapacity before insert) is the correct
-- concurrency guard for ALL capacity values. This index only enforced
-- capacity=1 at the DB level, silently blocking any project with
-- sessionCapacity > 1 via a P2002 caught as "slot_full".
DROP INDEX IF EXISTS "Booking_project_slot_confirmed_unique";
