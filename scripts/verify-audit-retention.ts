import "dotenv/config";
import { db } from "@/lib/db";
import { purgeAuditAndNotificationLogs, getSetting, setSetting } from "@/lib/data/audit-retention";

const TS = Date.now().toString().slice(-8);
const BULK_PREFIX = `cap-${TS}`;

let failures = 0;
function check(name: string, cond: boolean, extra = "") {
  const ok = !!cond;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${extra ? `  -> ${extra}` : ""}`);
  if (!ok) failures++;
}

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 86400000);
}

async function createAuditRows(count: number, createdAt: Date, prefix = "test"): Promise<string[]> {
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const row = await db.auditLog.create({
      data: {
        action: "booking_created",
        actorType: "participant",
        actorLabel: `${prefix}-${TS}-${i}`,
        entityType: "Booking",
        entityId: `e-${prefix}-${TS}-${i}`,
        createdAt,
      },
    });
    ids.push(row.id);
  }
  return ids;
}

async function createNotificationLogRows(count: number, createdAt: Date): Promise<string[]> {
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const row = await db.notificationLog.create({
      data: {
        category: "booking_confirmation",
        recipientEmail: `test-${TS}-${i}@test.local`,
        recipientRole: "participant",
        subject: "Test",
        renderedBody: "<p>Test</p>",
        status: "sent",
        createdAt,
      },
    });
    ids.push(row.id);
  }
  return ids;
}

async function main() {
  console.log(`\n=== VERIFY AUDIT RETENTION (ts=${TS}) ===\n`);

  const originalAuditRetention = await getSetting("audit_retention_days");
  const originalNotifRetention = await getSetting("notification_retention_days");
  const originalLastPurge = await getSetting("last_audit_purge_at");

  try {
    await setSetting("audit_retention_days", "30");
    await setSetting("notification_retention_days", "30");
    await db.systemSetting.deleteMany({ where: { key: "last_audit_purge_at" } });

    const staleAuditCutoff = new Date(Date.now() - 30 * 86400000);
    const staleAuditCleanup = await db.auditLog.deleteMany({ where: { createdAt: { lt: staleAuditCutoff } } });
    console.log(`[setup] cleaned ${staleAuditCleanup.count} pre-existing old audit rows`);

    const allAuditIds: string[] = [];
    const allNotifIds: string[] = [];

    console.log("--- Test 1: Steady-state purge (rows older than cutoff deleted, newer untouched) ---");
    {
      await db.systemSetting.deleteMany({ where: { key: "last_audit_purge_at" } });

      const recentAudit = await createAuditRows(5, daysAgo(10), "recent1");
      allAuditIds.push(...recentAudit);
      const oldAudit = await createAuditRows(5, daysAgo(60), "old1");
      allAuditIds.push(...oldAudit);
      const veryOldAudit = await createAuditRows(3, daysAgo(90), "vold1");
      allAuditIds.push(...veryOldAudit);

      await setSetting("last_audit_purge_at", daysAgo(45).toISOString());

      const result = await purgeAuditAndNotificationLogs();

      const remaining = await db.auditLog.findMany({
        where: { id: { in: [...recentAudit, ...oldAudit, ...veryOldAudit] } },
        select: { id: true },
      });
      const remainingIds = new Set(remaining.map((r) => r.id));

      const oldDeleted = oldAudit.filter((id) => !remainingIds.has(id)).length;
      const veryOldDeleted = veryOldAudit.filter((id) => !remainingIds.has(id)).length;
      const recentStillExist = recentAudit.every((id) => remainingIds.has(id));

      check("old rows (60d, past 30d cutoff) deleted", oldDeleted === 5, `deleted=${oldDeleted}`);
      check("very old rows (90d) also deleted", veryOldDeleted === 3, `deleted=${veryOldDeleted}`);
      check("recent rows (10d, within cutoff) untouched", recentStillExist, `remaining=${remaining.length}`);
      check("auditRowsExported = 8 (5 old + 3 very old)", result.auditRowsExported === 8, `exported=${result.auditRowsExported}`);
      check("last_audit_purge_at updated", (await getSetting("last_audit_purge_at")) !== null);
    }

    console.log("\n--- Test 2: First-run behavior (no last_purge_at) ---");
    {
      await db.systemSetting.deleteMany({ where: { key: "last_audit_purge_at" } });

      const freshAudit = await createAuditRows(3, daysAgo(5), "fresh2");
      allAuditIds.push(...freshAudit);
      const oldAudit = await createAuditRows(8, daysAgo(60), "old2");
      allAuditIds.push(...oldAudit);

      const result = await purgeAuditAndNotificationLogs();

      const remaining = await db.auditLog.findMany({
        where: { id: { in: [...freshAudit, ...oldAudit] } },
        select: { id: true },
      });
      const remainingIds = new Set(remaining.map((r) => r.id));

      const freshStillExist = freshAudit.every((id) => remainingIds.has(id));
      const oldDeleted = oldAudit.filter((id) => !remainingIds.has(id)).length;

      check("fresh rows (5d, within cutoff) untouched", freshStillExist, `remaining=${remaining.length}`);
      check("old rows (60d, past cutoff) all exported+deleted on first run", oldDeleted === 8, `deleted=${oldDeleted}`);
      check("first run: no cap hit (8 < 50000)", !result.capped, `capped=${result.capped}`);
      check("last_audit_purge_at set after first run", (await getSetting("last_audit_purge_at")) !== null);
    }

    console.log("\n--- Test 3: First-run cap (>50k rows) ---");
    {
      await db.systemSetting.deleteMany({ where: { key: "last_audit_purge_at" } });

      const freshAudit = await createAuditRows(2, daysAgo(5), "fresh3");
      allAuditIds.push(...freshAudit);

      await db.$executeRawUnsafe(
        `DELETE FROM "AuditLog" WHERE "id" LIKE $1 || '-%'`,
        BULK_PREFIX
      );

      const bulkCount = 50001;
      for (let i = 0; i < bulkCount; i += 1000) {
        const batch = Math.min(1000, bulkCount - i);
        await db.$executeRawUnsafe(
          `INSERT INTO "AuditLog" ("id", "action", "actorType", "actorLabel", "entityType", "entityId", "createdAt")
           SELECT $1 || '-' || (g + $4), 'booking_created', 'participant', 'bulk-' || (g + $4), 'Booking', 'bulk-' || (g + $4), $2::timestamp
           FROM generate_series(0, $3 - 1) AS g`,
          BULK_PREFIX, daysAgo(60).toISOString(), batch, i
        );
      }

      const totalBefore = await db.auditLog.count({
        where: { id: { contains: BULK_PREFIX } },
      });
      check("bulk insert succeeded (50001 rows)", totalBefore === 50001, `count=${totalBefore}`);

      const result = await purgeAuditAndNotificationLogs();

      check("first run capped at 50000", result.capped === true, `capped=${result.capped}`);
      check("auditRowsExported = 50000 (cap)", result.auditRowsExported === 50000, `exported=${result.auditRowsExported}`);

      const remainingBulk = await db.auditLog.count({
        where: { id: { contains: BULK_PREFIX } },
      });
      check("1 bulk row remains after cap", remainingBulk === 1, `remaining=${remainingBulk}`);

      await db.$executeRawUnsafe(
        `DELETE FROM "AuditLog" WHERE "id" LIKE $1 || '-%'`,
        BULK_PREFIX
      );
    }

    console.log("\n--- Test 4: NotificationLog hard-delete ---");
    {
      await db.systemSetting.deleteMany({ where: { key: "last_audit_purge_at" } });

      const recentNotif = await createNotificationLogRows(4, daysAgo(10));
      allNotifIds.push(...recentNotif);
      const oldNotif = await createNotificationLogRows(6, daysAgo(60));
      allNotifIds.push(...oldNotif);

      const result = await purgeAuditAndNotificationLogs();

      const remaining = await db.notificationLog.findMany({
        where: { id: { in: [...recentNotif, ...oldNotif] } },
        select: { id: true },
      });
      const remainingIds = new Set(remaining.map((r) => r.id));

      const oldDeleted = oldNotif.filter((id) => !remainingIds.has(id)).length;
      const recentStillExist = recentNotif.every((id) => remainingIds.has(id));

      check("old NotificationLog rows (60d, past 30d cutoff) deleted", oldDeleted === 6, `deleted=${oldDeleted}`);
      check("recent NotificationLog rows (10d) untouched", recentStillExist, `remaining=${remaining.length}`);
      check("notificationRowsDeleted count = 6", result.notificationRowsDeleted === 6, `deleted=${result.notificationRowsDeleted}`);
    }

    console.log("\n--- Test 5: Email failure — purge still succeeds ---");
    {
      await db.systemSetting.deleteMany({ where: { key: "last_audit_purge_at" } });

      const originalKey = process.env.RESEND_API_KEY;
      process.env.RESEND_API_KEY = "re_fake_key_for_test";

      const auditRows = await createAuditRows(3, daysAgo(60), "email5");
      allAuditIds.push(...auditRows);

      const result = await purgeAuditAndNotificationLogs();

      const remaining = await db.auditLog.findMany({
        where: { id: { in: auditRows } },
        select: { id: true },
      });

      check("audit rows deleted despite email failure", remaining.length === 0, `remaining=${remaining.length}`);
      check("emailSent = false", result.emailSent === false, `emailSent=${result.emailSent}`);
      check("emailSkippedReason set (email failed)", result.emailSkippedReason !== undefined, result.emailSkippedReason ?? "");

      if (originalKey !== undefined) {
        process.env.RESEND_API_KEY = originalKey;
      } else {
        delete process.env.RESEND_API_KEY;
      }
    }

    console.log("\n--- Test 6: Missing org_owner — purge succeeds, email skipped ---");
    {
      await db.systemSetting.deleteMany({ where: { key: "last_audit_purge_at" } });

      const originalKey = process.env.RESEND_API_KEY;
      process.env.RESEND_API_KEY = "re_fake_key_for_test";

      const existingOwners = await db.admin.findMany({ where: { role: "org_owner" } });
      for (const o of existingOwners) {
        await db.admin.update({ where: { id: o.id }, data: { role: "super_admin" } });
      }

      const auditRows = await createAuditRows(2, daysAgo(60), "owner6");
      allAuditIds.push(...auditRows);

      const result = await purgeAuditAndNotificationLogs();

      const remaining = await db.auditLog.findMany({
        where: { id: { in: auditRows } },
        select: { id: true },
      });

      check("audit rows deleted even without org_owner", remaining.length === 0, `remaining=${remaining.length}`);
      check("emailSent = false (no owner)", result.emailSent === false);
      check("emailSkippedReason = 'no org_owner found'", result.emailSkippedReason === "no org_owner found", result.emailSkippedReason);

      for (const o of existingOwners) {
        await db.admin.update({ where: { id: o.id }, data: { role: "org_owner" } });
      }
      if (originalKey !== undefined) {
        process.env.RESEND_API_KEY = originalKey;
      } else {
        delete process.env.RESEND_API_KEY;
      }
    }

    console.log("\n--- Test 7: CRON_SECRET auth gate ---");
    {
      const { GET } = await import("@/app/api/cron/purge-audit-log/route");

      const noAuthReq = new Request("http://localhost:3000/api/cron/purge-audit-log");
      const noAuthRes = await GET(noAuthReq);
      check("401 with no auth header", noAuthRes.status === 401, `status=${noAuthRes.status}`);

      const wrongAuthReq = new Request("http://localhost:3000/api/cron/purge-audit-log", {
        headers: { authorization: "Bearer wrong-secret" },
      });
      const wrongAuthRes = await GET(wrongAuthReq);
      check("401 with wrong secret", wrongAuthRes.status === 401, `status=${wrongAuthRes.status}`);

      const originalSecret = process.env.CRON_SECRET;
      process.env.CRON_SECRET = "test-cron-secret-123";

      const validReq = new Request("http://localhost:3000/api/cron/purge-audit-log", {
        headers: { authorization: "Bearer test-cron-secret-123" },
      });
      const validRes = await GET(validReq);
      check("200 with correct secret", validRes.status === 200, `status=${validRes.status}`);

      if (originalSecret !== undefined) {
        process.env.CRON_SECRET = originalSecret;
      } else {
        delete process.env.CRON_SECRET;
      }
    }

  } finally {
    if (originalAuditRetention !== null) {
      await setSetting("audit_retention_days", originalAuditRetention);
    } else {
      await db.systemSetting.deleteMany({ where: { key: "audit_retention_days" } });
    }
    if (originalNotifRetention !== null) {
      await setSetting("notification_retention_days", originalNotifRetention);
    } else {
      await db.systemSetting.deleteMany({ where: { key: "notification_retention_days" } });
    }
    if (originalLastPurge !== null) {
      await setSetting("last_audit_purge_at", originalLastPurge);
    } else {
      await db.systemSetting.deleteMany({ where: { key: "last_audit_purge_at" } });
    }
    await db.$executeRawUnsafe(`DELETE FROM "AuditLog" WHERE "id" LIKE $1 || '-%'`, BULK_PREFIX);
  }

  console.log(
    failures === 0
      ? "\n=== VERIFY AUDIT RETENTION: ALL CHECKS PASSED ==="
      : `\n=== VERIFY AUDIT RETENTION: ${failures} CHECK(S) FAILED ===`
  );
  await db.$disconnect();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error("FATAL:", e);
  await db.$disconnect().catch(() => {});
  process.exit(1);
});
