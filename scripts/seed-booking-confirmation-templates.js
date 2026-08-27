#!/usr/bin/env node
/**
 * Standalone script to seed/ensure all three booking_confirmation email templates
 * exist (participant, admin, super_admin).
 * Safe to run on production — uses upsert logic per (category, audience).
 *
 * Usage: node scripts/seed-booking-confirmation-templates.js
 */
require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");

const TEMPLATES = [
  {
    category: "booking_confirmation",
    audience: "participant",
    subject: "Confirmed: {{project_name}} on {{session_date}}",
    bodyHtml: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
<p>Hi {{participant_name}},</p>
<p>Your session is confirmed.</p>
<div style="border:2px dashed #DCE1FB;border-radius:12px;padding:20px;margin:20px 0;background:#EEF1FD;">
<p style="margin:0 0 8px;"><strong>{{project_name}}</strong></p>
<p style="margin:0 0 4px;">{{session_date}} · {{session_time}}</p>
<p style="margin:0 0 4px;">{{time_zone}}</p>
{{#unless is_feedback}}<p style="margin:0 0 4px;">Interviewer: {{admin_name}}</p>
{{/unless is_feedback}}{{#unless has_meeting_link}}<p style="margin:12px 0 0;color:#6b7280;">Your meeting link is pending — you'll receive it shortly.</p>
{{/unless has_meeting_link}}{{#unless no_meeting_link}}<p style="margin:12px 0 0;"><a href="{{meeting_link}}" style="color:#4338CA;font-weight:600;">Join {{meeting_platform_label}} meeting</a></p>
{{/unless no_meeting_link}}</div>
<p style="margin:16px 0;"><a href="{{manage_booking_link}}" style="color:#4338CA;">Manage your booking</a> — reschedule or cancel while the self-service window is open.</p>
<p>The meeting link will also appear on your calendar invitation shortly.</p>
<p>Thanks,<br/>{{company_name}}</p>
</div>`,
  },
  {
    category: "booking_confirmation",
    audience: "admin",
    subject: "New session booked: {{participant_name}} — {{project_name}}",
    bodyHtml: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
<p>Hi {{admin_name}},</p>
<p>A new session has been booked for <strong>{{project_name}}</strong>.</p>
<div style="border:2px dashed #DCE1FB;border-radius:12px;padding:20px;margin:20px 0;background:#EEF1FD;">
<p style="margin:0 0 8px;"><strong>{{project_name}}</strong></p>
<p style="margin:0 0 4px;">{{session_date}} · {{session_time}}</p>
<p style="margin:0 0 4px;">{{time_zone}}</p>
{{#unless is_feedback}}<p style="margin:0 0 4px;">Interviewer: {{admin_name}}</p>
{{/unless is_feedback}}<p style="margin:0 0 4px;">Participant: {{participant_name}} ({{participant_email}})</p>
{{#unless has_meeting_link}}<p style="margin:12px 0 0;color:#6b7280;">Meeting link is pending — you'll receive it shortly.</p>
{{/unless has_meeting_link}}{{#unless no_meeting_link}}<p style="margin:12px 0 0;"><a href="{{meeting_link}}" style="color:#4338CA;font-weight:600;">Join {{meeting_platform_label}} meeting</a></p>
{{/unless no_meeting_link}}</div>
<p style="margin:16px 0;"><a href="{{manage_booking_link}}" style="color:#4338CA;">View or manage this session in your dashboard</a>.</p>
<p>Best,<br/>{{company_name}}</p>
</div>`,
  },
  {
    category: "booking_confirmation",
    audience: "super_admin",
    subject: "Session booked: {{participant_name}} with {{admin_name}} — {{project_name}}",
    bodyHtml: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
<p>Hi {{admin_name}},</p>
<p>A new session has been booked for <strong>{{project_name}}</strong>.</p>
<div style="border:2px dashed #DCE1FB;border-radius:12px;padding:20px;margin:20px 0;background:#EEF1FD;">
<p style="margin:0 0 8px;"><strong>{{project_name}}</strong></p>
<p style="margin:0 0 4px;">{{session_date}} · {{session_time}}</p>
<p style="margin:0 0 4px;">{{time_zone}}</p>
{{#unless is_feedback}}<p style="margin:0 0 4px;">Interviewer: {{admin_name}}</p>
{{/unless is_feedback}}<p style="margin:0 0 4px;">Participant: {{participant_name}} ({{participant_email}})</p>
{{#unless has_meeting_link}}<p style="margin:12px 0 0;color:#6b7280;">Meeting link is pending — you'll receive it shortly.</p>
{{/unless has_meeting_link}}{{#unless no_meeting_link}}<p style="margin:12px 0 0;"><a href="{{meeting_link}}" style="color:#4338CA;font-weight:600;">Join {{meeting_platform_label}} meeting</a></p>
{{/unless no_meeting_link}}{{#unless no_zoom_account}}<p style="margin:8px 0 4px;">Zoom account: {{zoom_account_label}} ({{zoom_account_email}})</p>
{{/unless no_zoom_account}}</div>
<p style="margin:16px 0;"><a href="{{manage_booking_link}}" style="color:#4338CA;">View or manage this session in your dashboard</a>.</p>
<p>Best,<br/>{{company_name}}</p>
</div>`,
  },
];

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const db = new PrismaClient({ adapter });

  try {
    let created = 0;
    let updated = 0;

    for (const t of TEMPLATES) {
      const existing = await db.emailTemplate.findFirst({
        where: { category: t.category, audience: t.audience, projectId: null, isActive: true },
      });

      if (existing) {
        // Only update if content changed
        if (existing.subject !== t.subject || existing.bodyHtml !== t.bodyHtml) {
          await db.emailTemplate.update({
            where: { id: existing.id },
            data: { subject: t.subject, bodyHtml: t.bodyHtml, version: existing.version + 1 },
          });
          console.log(`  Updated: ${t.category}/${t.audience} (v${existing.version} -> v${existing.version + 1})`);
          updated++;
        } else {
          console.log(`  Already up to date: ${t.category}/${t.audience}`);
        }
      } else {
        await db.emailTemplate.create({
          data: {
            category: t.category,
            audience: t.audience,
            projectId: null,
            subject: t.subject,
            bodyHtml: t.bodyHtml,
            version: 1,
            isActive: true,
          },
        });
        console.log(`  Created: ${t.category}/${t.audience}`);
        created++;
      }
    }

    console.log(`\nDone: ${created} created, ${updated} updated, ${TEMPLATES.length - created - updated} unchanged.`);
  } catch (err) {
    console.error("[seed-booking-confirmation] Error:", err);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

main();
