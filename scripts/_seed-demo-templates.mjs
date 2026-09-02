import pg from "pg";

const url = process.argv[2] ?? process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL required (argv[2] or env)");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: url });
const DEMO = "demo-project-fidlaque";
const now = new Date().toISOString();

const tpls = [
  {
    id: "cmdtpl-bc-participant-0001",
    category: "booking_confirmation",
    audience: "participant",
    subject: "{{participant_name}}, your {{project_name}} session is confirmed",
    bodyHtml:
      "<p>Hi {{participant_name}},</p><p>Your {{project_name}} session is confirmed for {{session_date}} at {{session_time}}.</p>" +
      '<p>Modify or cancel: <a href="{{manage_booking_link}}">manage</a></p>' +
      '<p>Book again: <a href="{{booking_link}}">book</a></p>',
  },
  {
    id: "cmdtpl-bc-admin-0001",
    category: "booking_confirmation",
    audience: "admin",
    subject: "{{participant_name}} booked {{project_name}}",
    bodyHtml:
      "<p>{{participant_name}} ({{participant_email}}) booked {{session_date}} at {{session_time}}.</p>" +
      '<p><a href="{{manage_booking_link}}">Open booking</a></p>',
  },
  {
    id: "cmdtpl-pin-participant-0001",
    category: "verification_pin",
    audience: "participant",
    subject: "Your {{project_name}} verification code",
    bodyHtml: "<p>Your verification code: <strong>{{pin}}</strong></p>",
  },
];

try {
  await pool.query(
    `DELETE FROM "EmailTemplate" WHERE "projectId" = $1 AND category IN ('booking_confirmation', 'verification_pin')`,
    [DEMO]
  );
  for (const t of tpls) {
    await pool.query(
      `INSERT INTO "EmailTemplate" (id, category, audience, "projectId", subject, "bodyHtml", version, "isActive", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, 1, true, $7, $7)`,
      [t.id, t.category, t.audience, DEMO, t.subject, t.bodyHtml, now]
    );
  }
  console.log(`demo templates seeded for ${DEMO}: ${tpls.map((t) => `${t.category}/${t.audience}`).join(", ")}`);
} finally {
  await pool.end();
}