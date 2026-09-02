import pg from "pg";
import { readFileSync } from "fs";

const scratch = readFileSync("C:/Users/mwebi/AppData/Local/Temp/opencode/scratch-url-clean.txt", "utf8").trim();
const envFile = readFileSync(".env", "utf8");
const prod = envFile.split("\n").find((l) => l.startsWith("DATABASE_URL=")).split("=").slice(1).join("=").trim();

async function run(url, label) {
  const pool = new pg.Pool({ connectionString: url });
  try {
    const proj = await pool.query(
      `UPDATE "Project" SET description = replace(description, 'Scheduler', 'Eureka')
        WHERE slug = 'senior-pm-interview' RETURNING id, description`
    );
    const tpl = await pool.query(
      `UPDATE "EmailTemplate" SET "bodyHtml" = replace("bodyHtml", 'Scheduler', 'Eureka')
        WHERE "projectId" IS NULL AND "bodyHtml" LIKE '%Scheduler%' RETURNING id, category, audience, subject`
    );
    const pAfter = await pool.query(`SELECT description FROM "Project" WHERE slug = 'senior-pm-interview'`);
    const tRemaining = await pool.query(
      `SELECT COUNT(*)::int AS n FROM "EmailTemplate" WHERE "bodyHtml" LIKE '%Scheduler%'`
    );
    const allLogs = await pool.query(
      `SELECT COUNT(*)::int AS n FROM "NotificationLog" WHERE subject LIKE '%Scheduler%' OR "renderedBody" LIKE '%Scheduler%'`
    );
    const demoLogs = await pool.query(
      `SELECT COUNT(*)::int AS n FROM "NotificationLog" WHERE "projectId" = 'demo-project-fidlaque' AND (subject LIKE '%Scheduler%' OR "renderedBody" LIKE '%Scheduler%')`
    );
    console.log(JSON.stringify({
      db: label,
      updatedProject: proj.rowCount,
      projectDescriptionAfter: pAfter.rows[0].description,
      updatedTemplates: tpl.rowCount,
      templateIds: tpl.rows.map((r) => r.id),
      remainingTemplatesWithScheduler: tRemaining.rows[0].n,
      allNotificationLogsWithScheduler: allLogs.rows[0].n,
      demoNotificationLogsWithScheduler: demoLogs.rows[0].n,
    }, null, 2));
  } catch (e) {
    console.log(JSON.stringify({ db: label, error: String(e.message).slice(0, 300) }));
  } finally {
    await pool.end();
  }
}

await run(scratch, "scratch");
await run(prod, "prod");