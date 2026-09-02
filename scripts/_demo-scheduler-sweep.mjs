import pg from "pg";
import { readFileSync } from "fs";

const scratch = readFileSync("C:/Users/mwebi/AppData/Local/Temp/opencode/scratch-url-clean.txt", "utf8").trim();
const envFile = readFileSync(".env", "utf8");
const prod = envFile.split("\n").find((l) => l.startsWith("DATABASE_URL=")).split("=").slice(1).join("=").trim();

const DEMO = "demo-project-fidlaque";

async function scan(url, label) {
  const pool = new pg.Pool({ connectionString: url });
  const out = { label, hits: [] };
  const push = (table, key, keyVal, column, value) =>
    out.hits.push({ table, key, keyVal, column, value });
  try {
    const projects = (await pool.query(
      `SELECT id, name, description, company, "brandingSenderName" FROM "Project" WHERE id = $1 OR slug = $1`, [DEMO]
    )).rows;
    for (const p of projects) {
      if (p.name.includes("Scheduler")) push("Project", "id", p.id, "name", p.name);
      if (p.description.includes("Scheduler")) push("Project", "id", p.id, "description", p.description);
      if (p.company.includes("Scheduler")) push("Project", "id", p.id, "company", p.company);
      if (p.brandingSenderName.includes("Scheduler")) push("Project", "id", p.id, "brandingSenderName", p.brandingSenderName);
    }

    const staff = (await pool.query(
      `SELECT id, name, initials, email FROM "Admin" WHERE id IN ('demo-staff-1','demo-staff-2','demo-staff-3')`
    )).rows;
    for (const a of staff) {
      for (const col of ["name", "initials", "email"]) if (a[col].includes("Scheduler")) push("Admin", "id", a.id, col, a[col]);
    }

    const sessionTypes = (await pool.query(
      `SELECT id, name, description FROM "SessionType" WHERE name ILIKE '%scheduler%' OR description ILIKE '%scheduler%'`
    )).rows;
    for (const s of sessionTypes) {
      if (s.name.includes("Scheduler")) push("SessionType", "id", s.id, "name", s.name);
      if (s.description.includes("Scheduler")) push("SessionType", "id", s.id, "description", s.description);
    }

    const templates = (await pool.query(
      `SELECT id, category, audience, "projectId", subject, "bodyHtml" FROM "EmailTemplate"`
    )).rows;
    for (const t of templates) {
      const context = t.projectId === DEMO ? "demo" : t.projectId === null ? "global" : "other";
      if (t.subject.includes("Scheduler")) push("EmailTemplate", "id", t.id, `subject (${context})`, t.subject);
      if (t.bodyHtml.includes("Scheduler")) push("EmailTemplate", "id", t.id, `bodyHtml (${context})`, "BODY CONTAINS 'Scheduler'");
    }

    const logs = (await pool.query(
      `SELECT id, "templateId", "projectId", category, subject, "renderedBody" FROM "NotificationLog" WHERE "projectId" = $1 AND (subject LIKE '%Scheduler%' OR "renderedBody" LIKE '%Scheduler%')`, [DEMO]
    )).rows;
    for (const l of logs) {
      if (l.subject.includes("Scheduler")) push("NotificationLog", "id", l.id, "subject", l.subject);
      if (l.renderedBody.includes("Scheduler")) push("NotificationLog", "id", l.id, "renderedBody", "BODY CONTAINS 'Scheduler'");
    }

    const parts = (await pool.query(
      `SELECT id, name, email, "customFields" FROM "Participant" WHERE "projectId" = $1`, [DEMO]
    )).rows;
    for (const p of parts) {
      const cf = JSON.stringify(p.customFields ?? "");
      for (const col of ["name", "email"]) if (p[col].includes("Scheduler")) push("Participant", "id", p.id, col, p[col]);
      if (cf.includes("Scheduler")) push("Participant", "id", p.id, "customFields", cf);
    }
  } catch (e) {
    out.error = String(e.message).slice(0, 300);
  } finally {
    await pool.end();
  }
  return out;
}

const [s, p] = await Promise.all([scan(scratch, "scratch"), scan(prod, "prod")]);
console.log(JSON.stringify({ scratch: s, prod: p }, null, 2));