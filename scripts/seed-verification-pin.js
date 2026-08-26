#!/usr/bin/env node
/**
 * Standalone script to seed/ensure the verification_pin email template exists.
 * Safe to run on production — uses upsert logic (creates if missing, updates if exists).
 *
 * Usage: node scripts/seed-verification-pin.js
 */
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");

const TEMPLATE = {
  category: "verification_pin",
  audience: "participant",
  subject: "Your verification code: {{pin}}",
  bodyHtml: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
<p>Hi {{participant_name}},</p>
<p>Your verification code for <strong>{{project_name}}</strong> is:</p>
<div style="background:#EEF1FD;border:2px dashed #DCE1FB;border-radius:12px;padding:20px;margin:20px 0;text-align:center;">
<p style="margin:0;font-size:32px;font-weight:700;letter-spacing:8px;color:#4338CA;">{{pin}}</p>
</div>
<p>This code expires in 10 minutes.</p>
<p>If you did not request this code, you can safely ignore this email.</p>
<p>Best,<br/>{{company_name}}</p>
</div>`,
};

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const db = new PrismaClient({ adapter });

  try {
    const existing = await db.emailTemplate.findFirst({
      where: { category: TEMPLATE.category, projectId: null, isActive: true },
    });

    if (existing) {
      console.log(`[seed-verification-pin] Template already exists (id=${existing.id}, version=${existing.version}). Updating...`);
      await db.emailTemplate.update({
        where: { id: existing.id },
        data: {
          subject: TEMPLATE.subject,
          bodyHtml: TEMPLATE.bodyHtml,
          version: existing.version + 1,
        },
      });
      console.log("[seed-verification-pin] Template updated successfully.");
    } else {
      console.log("[seed-verification-pin] Template not found. Creating...");
      await db.emailTemplate.create({
        data: {
          category: TEMPLATE.category,
          audience: TEMPLATE.audience,
          projectId: null,
          subject: TEMPLATE.subject,
          bodyHtml: TEMPLATE.bodyHtml,
          version: 1,
          isActive: true,
        },
      });
      console.log("[seed-verification-pin] Template created successfully.");
    }
  } catch (err) {
    console.error("[seed-verification-pin] Error:", err);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

main();
