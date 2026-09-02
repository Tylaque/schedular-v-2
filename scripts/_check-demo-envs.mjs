import pg from "pg";

const urls = {
  prod: process.argv[2],
  scratch: process.argv[3],
};

async function checkDb(name, url) {
  if (!url) return `[${name}] URL missing`;
  const pool = new pg.Pool({ connectionString: url });
  try {
    const dbName = url.split("/").pop().split("?")[0];
    const proj = await pool.query(`SELECT id, slug, "ownerId", status FROM "Project" WHERE slug = $1`, ["senior-pm-interview"]);
    const demoId = proj.rows[0]?.id ?? null;
    const bookings = demoId
      ? (await pool.query(`SELECT COUNT(*)::int AS n FROM "Booking" WHERE "projectId" = $1`, [demoId])).rows[0].n
      : null;
    const staff = (await pool.query(`SELECT COUNT(*)::int AS n FROM "Admin" WHERE id IN ('demo-staff-1','demo-staff-2','demo-staff-3')`)).rows[0].n;
    const realAdmins = (await pool.query(`SELECT COUNT(*)::int AS n FROM "Admin"`)).rows[0].n;
    return JSON.stringify({ db: dbName, demoProject: proj.rows[0] ?? null, demoBookings: bookings, demoStaff: staff, totalAdmins: realAdmins });
  } catch (e) {
    return `[${name}] ERROR: ${String(e.message).slice(0, 200)}`;
  } finally {
    await pool.end();
  }
}

console.log("PROD:  ", await checkDb("prod", urls.prod));
console.log("SCRATCH:", await checkDb("scratch", urls.scratch));