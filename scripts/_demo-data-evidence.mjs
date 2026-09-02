import pg from "pg";
import { readFileSync } from "fs";

const scratch = readFileSync("C:/Users/mwebi/AppData/Local/Temp/opencode/scratch-url-clean.txt", "utf8").trim();
const pool = new pg.Pool({ connectionString: scratch });

const proj = (await pool.query(
  `SELECT id, slug, name, company, "ownerId", status, "brandingSenderName" FROM "Project" WHERE slug = $1`,
  ["senior-pm-interview"]
)).rows[0];

const adminIds = await pool.query(
  `SELECT id, name, email FROM "Admin" WHERE id IN ('demo-staff-1','demo-staff-2','demo-staff-3') ORDER BY id`
);

const bookingCrew = await pool.query(
  `SELECT a.id AS admin_id, a.name AS admin_name, COUNT(b.id)::int AS bookings
     FROM "Booking" b JOIN "Admin" a ON a.id = b."adminId"
    WHERE b."projectId" = $1
    GROUP BY a.id, a.name ORDER BY a.id`,
  [proj.id]
);

const nonDemoAdmins = await pool.query(
  `SELECT COUNT(*)::int AS n FROM "Booking" WHERE "projectId" = $1 AND "adminId" NOT IN ('demo-staff-1','demo-staff-2','demo-staff-3')`,
  [proj.id]
);

const totals = await pool.query(
  `SELECT
     (SELECT COUNT(*)::int FROM "Booking" WHERE "projectId" = $1) AS demo_bookings,
     (SELECT COUNT(*)::int FROM "Booking") AS all_bookings,
     (SELECT COUNT(*)::int FROM "Admin") AS all_admins`,
  [proj.id]
);

console.log(JSON.stringify({
  project: proj,
  demoStaff: adminIds.rows,
  bookingCrew: bookingCrew.rows,
  bookingsOutsideDemoStaff: nonDemoAdmins.rows[0].n,
  totals: totals.rows[0],
}, null, 2));

await pool.end();