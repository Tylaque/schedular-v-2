import pg from "pg";
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const out = {};
out.demoConfirmed = (await pool.query(
  `SELECT COUNT(*)::int AS n FROM "Booking" b JOIN "Project" p ON p.id = b."projectId" WHERE p.slug = $1 AND b.status = 'confirmed'`,
  ["senior-pm-interview"]
)).rows[0].n;
out.allDemoBookings = (await pool.query(
  `SELECT COUNT(*)::int AS n FROM "Booking" b JOIN "Project" p ON p.id = b."projectId" WHERE p.slug = $1`,
  ["senior-pm-interview"]
)).rows[0].n;
out.project = (await pool.query(`SELECT id, slug, "ownerId", status FROM "Project" WHERE slug = $1`, ["senior-pm-interview"])).rows[0];
out.anyMeeting = (await pool.query(
  `SELECT COUNT(*)::int AS n FROM "Booking" b JOIN "Project" p ON p.id = b."projectId" WHERE p.slug = $1 AND (b."meetingPlatform" IS NOT NULL OR b."zoomProvisionStatus" IS NOT NULL)`,
  ["senior-pm-interview"]
)).rows[0].n;
out.e2eTestRows = (await pool.query(
  `SELECT COUNT(*)::int AS n FROM "Booking" WHERE "participantEmail" LIKE 'demo.e2e.%'`
)).rows[0].n;
console.log(JSON.stringify(out, null, 2));
await pool.end();