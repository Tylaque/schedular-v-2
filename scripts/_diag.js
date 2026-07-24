const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

(async () => {
  // Check availability slots (correct table name)
  const availability = await prisma.$queryRawUnsafe(
    `SELECT id, "adminId", "dateKey", time FROM "AdminAvailability" WHERE "projectId" = 'seed-project-1' ORDER BY "dateKey" ASC, time ASC LIMIT 30`
  );
  console.log("=== ADMIN AVAILABILITY (" + availability.length + " rows) ===");
  console.log(JSON.stringify(availability, null, 2));

  // Check participants
  const participants = await prisma.$queryRawUnsafe(
    `SELECT id, name, email, status FROM "Participant" WHERE "projectId" = 'seed-project-1'`
  );
  console.log("=== PARTICIPANTS (" + participants.length + ") ===");
  console.log(JSON.stringify(participants, null, 2));

  // Check bookings
  const bookings = await prisma.$queryRawUnsafe(
    `SELECT id, status, "teamsProvisionStatus", "teamsMeetingId", "teamsJoinUrl" IS NOT NULL as "hasJoinUrl", "teamsErrorDetail", "participantEmail", "adminId", "dateKey", time FROM "Booking" WHERE "projectId" = 'seed-project-1'`
  );
  console.log("=== BOOKINGS (" + bookings.length + ") ===");
  console.log(JSON.stringify(bookings, null, 2));

  // Check which admins are assigned to this project
  const projectAdmins = await prisma.$queryRawUnsafe(
    `SELECT pa."adminId", a.email, a.name FROM "ProjectAdmin" pa JOIN "Admin" a ON a.id = pa."adminId" WHERE pa."projectId" = 'seed-project-1'`
  );
  console.log("=== PROJECT ADMINS (" + projectAdmins.length + ") ===");
  console.log(JSON.stringify(projectAdmins, null, 2));

  await prisma.$disconnect();
  await pool.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
