// Session-type classification feature verification.
// Creates FEEDBACK and STANDARD session types, renders templates with each
// classification, and asserts that admin name is omitted for FEEDBACK and
// present for STANDARD. Shows actual rendered HTML for both cases.
//
// Usage: DATABASE_URL=... npx tsx scripts/verify-session-type-classification.ts
import "dotenv/config";
import { db } from "@/lib/db";
import { renderTemplate } from "@/lib/template-utils";
import { ensureSeedSessionTypes } from "@/lib/data/session-types";

let failures = 0;
let pass = 0;
function check(label: string, ok: boolean, detail?: string) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  -> ${detail}` : ""}`);
  if (ok) pass++;
  else failures++;
}

// The booking_confirmation template from seed.ts (updated with {{#unless is_feedback}})
const BOOKING_CONFIRMATION_TEMPLATE = {
  subject: "Confirmed: {{project_name}} on {{session_date}}",
  bodyHtml: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
<p>Hi {{participant_name}},</p>
<p>Your session is confirmed.</p>
<div style="border:2px dashed #DCE1FB;border-radius:12px;padding:20px;margin:20px 0;background:#EEF1FD;">
<p style="margin:0 0 8px;"><strong>{{project_name}}</strong></p>
<p style="margin:0 0 4px;">{{session_date}} · {{session_time}}</p>
<p style="margin:0 0 4px;">{{time_zone}}</p>
{{#unless is_feedback}}<p style="margin:0 0 4px;">Interviewer: {{admin_name}}</p>
{{/unless is_feedback}}<p style="margin:12px 0 0;"><a href="{{meeting_link}}" style="color:#4338CA;font-weight:600;">Join Microsoft Teams meeting</a></p>
</div>
<p style="margin:16px 0;"><a href="{{manage_booking_link}}" style="color:#4338CA;">Manage your booking</a> — reschedule or cancel while the self-service window is open.</p>
<p>The meeting link will also appear on your calendar invitation shortly.</p>
<p>Thanks,<br/>{{company_name}}</p>
</div>`,
};

const REMINDER_TEMPLATE = {
  subject: "Reminder: {{reminder_label}} — {{project_name}}",
  bodyHtml: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
<p>Hi {{participant_name}},</p>
<p>This is a reminder that your <strong>{{project_name}}</strong> session is coming up.</p>
<div style="border:2px dashed #DCE1FB;border-radius:12px;padding:20px;margin:20px 0;background:#EEF1FD;">
<p style="margin:0 0 8px;"><strong>{{project_name}}</strong></p>
<p style="margin:0 0 4px;">{{session_date}} · {{session_time}}</p>
<p style="margin:0 0 4px;">{{time_zone}}</p>
{{#unless is_feedback}}<p style="margin:0;">Interviewer: {{admin_name}}</p>
{{/unless is_feedback}}</div>
<p style="margin:24px 0;"><a href="{{meeting_link}}" style="background:#4338CA;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Join meeting</a></p>
<p>Please ensure you have a quiet space and a working camera/microphone.</p>
<p>See you there!<br/>{{company_name}}</p>
</div>`,
};

async function main() {
  const TS = Date.now().toString().slice(-8);

  // Create test session types
  const feedbackType = await db.sessionType.create({
    data: { name: `Feedback ${TS}`, description: "Test feedback type", classification: "FEEDBACK", isActive: true },
  });
  const standardType = await db.sessionType.create({
    data: { name: `Interview ${TS}`, description: "Test standard type", classification: "STANDARD", isActive: true },
  });
  console.log(`\nSession types created: FEEDBACK=${feedbackType.id}, STANDARD=${standardType.id}`);

  try {
    // ── Test 1: Verify classification stored correctly ──
    console.log("\n=== Test 1: Classification stored correctly ===");
    const fb = await db.sessionType.findUnique({ where: { id: feedbackType.id } });
    const st = await db.sessionType.findUnique({ where: { id: standardType.id } });
    check("FEEDBACK classification persisted", fb?.classification === "FEEDBACK", `got ${fb?.classification}`);
    check("STANDARD classification persisted", st?.classification === "STANDARD", `got ${st?.classification}`);

    // ── Test 2: Render booking_confirmation — STANDARD (admin name visible) ──
    console.log("\n=== Test 2: STANDARD session — admin name visible ===");
    const standardCtx = {
      participant_name: "Alice Standard",
      project_name: "Standard Interview Project",
      company_name: "Test Co",
      session_date: "2026-08-25",
      session_time: "10:00",
      time_zone: "UTC",
      admin_name: "Bob Interviewer",
      meeting_link: "https://example.com/meeting/std",
      booking_link: "https://example.com/book/std",
      manage_booking_link: "https://example.com/manage/std",
      company_logo: "",
      is_feedback: "",
      reminder_label: "",
    };
    const standardRendered = renderTemplate(BOOKING_CONFIRMATION_TEMPLATE, standardCtx);
    console.log("\n--- STANDARD booking_confirmation rendered HTML ---");
    console.log(standardRendered.bodyHtml);
    console.log("--- end ---\n");
    check(
      "STANDARD: admin name 'Bob Interviewer' present in body",
      standardRendered.bodyHtml.includes("Bob Interviewer"),
    );
    check(
      "STANDARD: 'Interviewer:' label present in body",
      standardRendered.bodyHtml.includes("Interviewer:"),
    );

    // ── Test 3: Render booking_confirmation — FEEDBACK (admin name hidden) ──
    console.log("\n=== Test 3: FEEDBACK session — admin name hidden ===");
    const feedbackCtx = {
      ...standardCtx,
      participant_name: "Charlie Feedback",
      admin_name: "Diana Hidden",
      is_feedback: "true",
    };
    const feedbackRendered = renderTemplate(BOOKING_CONFIRMATION_TEMPLATE, feedbackCtx);
    console.log("\n--- FEEDBACK booking_confirmation rendered HTML ---");
    console.log(feedbackRendered.bodyHtml);
    console.log("--- end ---\n");
    check(
      "FEEDBACK: admin name 'Diana Hidden' NOT in body",
      !feedbackRendered.bodyHtml.includes("Diana Hidden"),
    );
    check(
      "FEEDBACK: 'Interviewer:' label NOT in body",
      !feedbackRendered.bodyHtml.includes("Interviewer:"),
    );
    check(
      "FEEDBACK: no residual double-newline or empty <p> where the line was removed",
      !feedbackRendered.bodyHtml.includes("</p>\n\n<p"),
    );

    // ── Test 4: Render reminder — STANDARD ──
    console.log("\n=== Test 4: STANDARD reminder — admin name visible ===");
    const stdReminderCtx = { ...standardCtx, participant_name: "Alice Standard" };
    const stdReminder = renderTemplate(REMINDER_TEMPLATE, stdReminderCtx);
    console.log("\n--- STANDARD reminder rendered HTML ---");
    console.log(stdReminder.bodyHtml);
    console.log("--- end ---\n");
    check(
      "STANDARD reminder: admin name present",
      stdReminder.bodyHtml.includes("Bob Interviewer"),
    );

    // ── Test 5: Render reminder — FEEDBACK ──
    console.log("\n=== Test 5: FEEDBACK reminder — admin name hidden ===");
    const fbReminderCtx = { ...feedbackCtx };
    const fbReminder = renderTemplate(REMINDER_TEMPLATE, fbReminderCtx);
    console.log("\n--- FEEDBACK reminder rendered HTML ---");
    console.log(fbReminder.bodyHtml);
    console.log("--- end ---\n");
    check(
      "FEEDBACK reminder: admin name NOT in body",
      !fbReminder.bodyHtml.includes("Diana Hidden"),
    );
    check(
      "FEEDBACK reminder: 'Interviewer:' label NOT in body",
      !fbReminder.bodyHtml.includes("Interviewer:"),
    );

    // ── Test 6: ensureSeedSessionTypes sets Feedback seed to FEEDBACK ──
    console.log("\n=== Test 6: Seed session type classifications ===");
    await ensureSeedSessionTypes();
    const seedFeedback = await db.sessionType.findUnique({ where: { id: "seed_session_feedback" } });
    const seedInterview = await db.sessionType.findUnique({ where: { id: "seed_session_interview" } });
    const seedCoaching = await db.sessionType.findUnique({ where: { id: "seed_session_coaching" } });
    check("seed_session_feedback is FEEDBACK", seedFeedback?.classification === "FEEDBACK", `got ${seedFeedback?.classification}`);
    check("seed_session_interview is STANDARD", seedInterview?.classification === "STANDARD", `got ${seedInterview?.classification}`);
    check("seed_session_coaching is STANDARD", seedCoaching?.classification === "STANDARD", `got ${seedCoaching?.classification}`);

    // ── Test 7: Default classification for new session types is STANDARD ──
    console.log("\n=== Test 7: Default classification is STANDARD ===");
    const defaultType = await db.sessionType.create({
      data: { name: `Default ${TS}`, description: "no classification specified", isActive: true },
    });
    const fetched = await db.sessionType.findUnique({ where: { id: defaultType.id } });
    check("New session type defaults to STANDARD", fetched?.classification === "STANDARD", `got ${fetched?.classification}`);

    // Cleanup
    await db.sessionType.delete({ where: { id: feedbackType.id } });
    await db.sessionType.delete({ where: { id: standardType.id } });
    await db.sessionType.delete({ where: { id: defaultType.id } });
    console.log("\nCleanup complete.");
  } catch (err) {
    console.error("ERROR:", err);
    failures++;
  }

  console.log(`\n=== RESULTS: ${pass} PASS, ${failures} FAIL ===`);
  process.exit(failures > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
