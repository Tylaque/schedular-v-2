/**
 * Concurrency test: fires two simultaneous createBooking calls for the same
 * slot on a project with sessionCapacity=1. Verifies exactly one wins and
 * the other gets slot_full.
 *
 * Run: npx tsx scripts/concurrency-test.ts
 */

import "dotenv/config";
import { db } from "../lib/db";
import { createBooking } from "../lib/data/bookings";

const PROJECT_ID = "seed-project-1";
const DATE_KEY = "2026-07-08";
const TIME = "10:30";

async function main() {
  console.log("=== Concurrency Test ===");
  console.log(`Project: ${PROJECT_ID}, Slot: ${DATE_KEY} @ ${TIME}`);
  console.log("");

  // 1. Clean up any existing bookings for this slot
  const deleted = await db.booking.deleteMany({
    where: { projectId: PROJECT_ID, dateKey: DATE_KEY, time: TIME },
  });
  console.log(`Cleaned up ${deleted.count} existing booking(s)`);

  // 2. Verify the project's sessionCapacity
  const project = await db.project.findUnique({
    where: { id: PROJECT_ID },
    select: { sessionCapacity: true },
  });
  console.log(`Project sessionCapacity: ${project?.sessionCapacity}`);

  // 3. Verify at least one admin has availability for this slot
  const avail = await db.adminAvailability.findMany({
    where: { projectId: PROJECT_ID, dateKey: DATE_KEY, time: TIME },
    select: { adminId: true },
  });
  console.log(`Admins with availability for this slot: ${avail.map((a) => a.adminId).join(", ") || "NONE"}`);

  // 4. Fire two concurrent booking requests
  console.log("");
  console.log("Firing two concurrent booking requests...");

  const [result1, result2] = await Promise.all([
    createBooking({
      projectId: PROJECT_ID,
      dateKey: DATE_KEY,
      time: TIME,
      participantName: "Alice Test",
      participantEmail: "alice-concurrency@test.com",
    }),
    createBooking({
      projectId: PROJECT_ID,
      dateKey: DATE_KEY,
      time: TIME,
      participantName: "Bob Test",
      participantEmail: "bob-concurrency@test.com",
    }),
  ]);

  console.log("");
  console.log("=== Results ===");
  console.log(`Alice: ${result1.ok ? "SUCCESS" : "FAILED"}${!result1.ok ? ` (reason: ${result1.reason})` : ""}`);
  console.log(`Bob:   ${result2.ok ? "SUCCESS" : "FAILED"}${!result2.ok ? ` (reason: ${result2.reason})` : ""}`);

  // 5. Count bookings in the database for this slot
  const finalCount = await db.booking.count({
    where: { projectId: PROJECT_ID, dateKey: DATE_KEY, time: TIME, status: "confirmed" },
  });
  console.log(`Confirmed bookings in DB for this slot: ${finalCount}`);

  const successCount = [result1, result2].filter((r) => r.ok).length;
  const failureCount = [result1, result2].filter((r) => !r.ok).length;

  console.log("");
  if (successCount === 1 && failureCount === 1 && finalCount === 1) {
    console.log("*** TEST PASSED: Exactly one booking succeeded, one got slot_full, DB has exactly 1 row ***");
  } else {
    console.log(`*** TEST FAILED: Expected 1 success, 1 failure, 1 DB row. Got: ${successCount} success, ${failureCount} failure, ${finalCount} DB rows ***`);
  }

  await db.$disconnect();
}

main().catch((e) => {
  console.error("Test error:", e);
  process.exit(1);
});
