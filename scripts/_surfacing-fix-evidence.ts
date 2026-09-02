import { Pool } from "pg";

const DEMO_SLUG = "senior-pm-interview";
const DEMO_FIXED_ID = "demo-project-fidlaque";
const DEMO_STAFF_IDS = ["demo-staff-1", "demo-staff-2", "demo-staff-3"];
const FROM = "2026-08-01";
const TO = "2026-11-01";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL required");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function q(label: string, rows: unknown[]) {
  console.log(`--- ${label}: ${rows.length} row(s)`);
  console.log(JSON.stringify(rows, null, 2));
}

async function main() {
  const checks: string[] = [];
  const pass = (label: string, ok: boolean) => {
    console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
    checks.push(`${ok ? "PASS" : "FAIL"} ${label}`);
  };

  // ---------------- BEFORE: legacy unscoped queries ----------------
  const beforeAdmins = await pool.query(
    `SELECT id, name, email, role FROM "Admin" WHERE id = ANY($1) ORDER BY id`,
    [DEMO_STAFF_IDS]
  );
  const beforeProjects = await pool.query(
    `SELECT id, slug, name, "ownerId" FROM "Project" WHERE slug = $1`,
    [DEMO_SLUG]
  );
  const beforeDemoConfirmed = await pool.query(
    `SELECT COUNT(*)::int AS n FROM "Booking" b JOIN "Project" p ON p.id = b."projectId"
     WHERE b.status = 'confirmed' AND p.slug = $1`,
    [DEMO_SLUG]
  );
  const beforeSlots = await pool.query(
    `SELECT COUNT(*)::int AS n FROM "AdminAvailabilityRange" WHERE "adminId" = ANY($1)`,
    [DEMO_STAFF_IDS]
  );
  const beforeNotifLogs = await pool.query(
    `SELECT COUNT(*)::int AS n FROM "NotificationLog" WHERE "projectId" = $1`,
    [DEMO_FIXED_ID]
  );

  // ---------------- AFTER: real post-fix functions ----------------
  const { listTeamMembers } = await import("@/lib/data/team");
  const { listAllAdmins } = await import("@/lib/data/admins");
  const { listProjects } = await import("@/lib/data/projects");
  const {
    getSuperAdminStats,
    getAdminUtilization,
    getProjectProgress,
    getCalendarEvents,
  } = await import("@/lib/data/dashboard");
  const { getTeamAvailability } = await import("@/lib/data/availability-ranges");
  const { getBookingVolumeTrend, getProjectHealthMetrics } = await import("@/lib/data/analytics");
  const { generateReport } = await import("@/lib/data/reports");
  const { completePastConfirmedBookings } = await import("@/lib/data/booking-completion");

  // 1. Team page — listTeamMembers
  {
    const members = await listTeamMembers();
    const leaked = members.filter((m: any) => DEMO_STAFF_IDS.includes(m.id));
    pass("team.ts listTeamMembers excludes demo staff", leaked.length === 0);
    console.log(`  team members total=${members.length} demo=${leaked.length}`);
  }

  // 2. Admin dropdowns — listAllAdmins
  {
    const admins = await listAllAdmins();
    const leaked = admins.filter((a: any) => DEMO_STAFF_IDS.includes(a.id));
    pass("admins.ts listAllAdmins excludes demo staff", leaked.length === 0);
    console.log(`  active admins total=${admins.length} demo=${leaked.length}`);
  }

  // 3. Super-admin project list — api/projects route path (listProjects(undefined))
  {
    const projects = await listProjects(undefined);
    const leaked = projects.filter((p: any) => p.slug === DEMO_SLUG);
    pass("api/projects listProjects(undefined) excludes demo project", leaked.length === 0);
    console.log(`  projects total=${projects.length} demo=${leaked.length}`);
  }

  // 4. Dashboard org-wide
  {
    const expectedRealProjects = (await pool.query(
      `SELECT COUNT(*)::int AS n FROM "Project" p WHERE p.slug <> $1`, [DEMO_SLUG]
    )).rows[0].n;
    const stats = await getSuperAdminStats(undefined);
    pass(`dashboard getSuperAdminStats totalProjects excludes demo` +
      ` (got ${stats.totalProjects}, real non-demo=${expectedRealProjects})`,
      stats.totalProjects === expectedRealProjects);

    // Demo-exclusion delta: legacy unscoped count minus post-fix count must equal
    // the demo project's own confirmed bookings (which the fix removes).
    await completePastConfirmedBookings();
    const rawAllConfirmed = (await pool.query(
      `SELECT COUNT(*)::int AS n FROM "Booking" b JOIN "Project" p ON p.id = b."projectId"
       WHERE b.status = 'confirmed'`, []
    )).rows[0].n;
    const rawNonDemoConfirmed = (await pool.query(
      `SELECT COUNT(*)::int AS n FROM "Booking" b JOIN "Project" p ON p.id = b."projectId"
       WHERE b.status = 'confirmed' AND p.slug <> $1`, [DEMO_SLUG]
    )).rows[0].n;
    const demoConfirmedNow = (await pool.query(
      `SELECT COUNT(*)::int AS n FROM "Booking" b JOIN "Project" p ON p.id = b."projectId"
       WHERE b.status = 'confirmed' AND p.slug = $1`, [DEMO_SLUG]
    )).rows[0].n;
    pass(`dashboard getSuperAdminStats bookedSessions excludes demo` +
      ` (got ${stats.bookedSessions}, non-demo=${rawNonDemoConfirmed}, demo=${demoConfirmedNow},` +
      ` legacy-all=${rawAllConfirmed})`,
      stats.bookedSessions === rawNonDemoConfirmed &&
      rawAllConfirmed === rawNonDemoConfirmed + demoConfirmedNow &&
      stats.bookedSessions !== rawAllConfirmed);

    const util = await getAdminUtilization(undefined);
    const utilLeaked = util.filter((u: any) => DEMO_STAFF_IDS.includes(u.adminId));
    pass("dashboard getAdminUtilization excludes demo staff", utilLeaked.length === 0);
    console.log(`  utilization admins=${util.length} demo=${utilLeaked.length}`);

    const progress = await getProjectProgress(undefined);
    const progLeaked = progress.filter((p: any) => p.projectSlug === DEMO_SLUG);
    pass("dashboard getProjectProgress excludes demo project", progLeaked.length === 0);
    console.log(`  progress projects=${progress.length} demo=${progLeaked.length}`);
  }

  // 5. Reports org-wide
  {
    const bookingsSummary = await generateReport("bookings-summary", undefined);
    const bkLeaked = bookingsSummary.filter((r: any) => String(r.projectName).toLowerCase().includes("fidlaque"));
    pass("reports bookings-summary excludes demo bookings", bkLeaked.length === 0);

    const adminUtil = await generateReport("admin-utilization", undefined);
    const auLeaked = adminUtil.filter((r: any) => String(r.projectName).toLowerCase().includes("fidlaque"));
    pass("reports admin-utilization excludes demo project rows", auLeaked.length === 0);

    const notif = await generateReport("notification-log", undefined);
    const notifLeaked = notif.filter((r: any) => String(r.recipientEmail).includes("demo"));
    pass("reports notification-log excludes demo recipients", notifLeaked.length === 0);
    console.log(`  notification-log rows=${notif.length} demo=${notifLeaked.length}`);
  }

  // 6. Team availability org-wide
  {
    const avail = await getTeamAvailability(undefined, { fromDate: FROM, toDate: TO });
    const leaked = avail.filter((a: any) => DEMO_STAFF_IDS.includes(a.adminId));
    pass("team-availability getTeamAvailability(undefined) excludes demo staff", leaked.length === 0);
    console.log(`  admins with availability=${avail.length} demo=${leaked.length}`);
  }

  // 7. Calendar org-wide
  {
    const events = await getCalendarEvents({
      from: new Date(`${FROM}T00:00:00Z`),
      to: new Date(`${TO}T00:00:00Z`),
      ownerId: undefined,
    });
    const leaked = events.filter((e: any) => String(e.participantEmail).includes("notifications+demo-guest"));
    pass("calendar getCalendarEvents org_owner excludes demo bookings", leaked.length === 0);
    console.log(`  events=${events.length} demo=${leaked.length}`);
  }

  // 8. Analytics org-wide
  {
    const legacy = (await pool.query(
      `SELECT COUNT(*)::int AS n FROM "Booking" b JOIN "Project" p ON p.id = b."projectId"
       WHERE b."createdAt" >= $1 AND b."createdAt" <= $2`,
      [`${FROM}T00:00:00Z`, `${TO}T23:59:59Z`]
    )).rows[0].n;
    const volume = await getBookingVolumeTrend({ ownerId: undefined, projectId: undefined, fromDate: FROM, toDate: TO, granularity: "week" });
    const totalVolume = volume.reduce((n: number, b: any) => n + b.total, 0);
    pass(`analytics getBookingVolumeTrend excludes demo bookings` +
      ` (legacy in range=${legacy}, post-fix volume total=${totalVolume})`,
      totalVolume === legacy - (await pool.query(
        `SELECT COUNT(*)::int AS n FROM "Booking" b JOIN "Project" p ON p.id = b."projectId"
         WHERE p.slug = $1 AND b."createdAt" >= $2 AND b."createdAt" <= $3`,
        [DEMO_SLUG, `${FROM}T00:00:00Z`, `${TO}T23:59:59Z`]
      )).rows[0].n);
    console.log(`  volume buckets=${volume.length} total=${totalVolume} legacy=${legacy}`);

    const health = await getProjectHealthMetrics({ ownerId: undefined, projectId: undefined, fromDate: FROM, toDate: TO });
    const healthLeaked = health.filter((h: any) => h.projectSlug === DEMO_SLUG);
    pass("analytics getProjectHealthMetrics excludes demo project", healthLeaked.length === 0);
    console.log(`  health projects=${health.length} demo=${healthLeaked.length}`);
  }

  console.log("\n================ BEFORE-STATE ROWS (legacy unscoped queries) ================");
  await q("Admin table unscoped → demo staff rows (before listTeamMembers/listAllAdmins)", beforeAdmins.rows);
  await q("Project table unscoped → demo project row (before listProjects)", beforeProjects.rows);
  console.log(
    `before: demo confirmed bookings=${beforeDemoConfirmed.rows[0].n}, ` +
    `demo availability ranges=${beforeSlots.rows[0].n}, ` +
    `demo notification logs=${beforeNotifLogs.rows[0].n}`
  );

  const allPass = checks.every((c) => c.startsWith("PASS"));
  console.log("\n" + checks.join("\n"));
  console.log(allPass ? "\nALL CHECKS PASSED" : "\nSOME CHECKS FAILED");
  if (!allPass) process.exitCode = 1;
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(async () => { await pool.end(); });