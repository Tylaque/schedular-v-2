import { db } from "@/lib/db";
import { Resend } from "resend";

const MAX_FIRST_RUN_ROWS = 50_000;

const DEFAULT_AUDIT_RETENTION_DAYS = 730;
const DEFAULT_NOTIFICATION_RETENTION_DAYS = 90;

export async function getSetting(key: string): Promise<string | null> {
  const row = await db.systemSetting.findUnique({ where: { key } });
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await db.systemSetting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}

function parseRetentionDays(raw: string | null, fallback: number): number {
  if (!raw) return fallback;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function rowsToCsv(
  rows: Record<string, unknown>[],
  columns: { key: string; label: string }[]
): string {
  const header = columns.map((c) => c.label).join(",");
  const body = rows
    .map((r) =>
      columns
        .map((c) => {
          const v = r[c.key];
          if (v == null) return "";
          const s = String(v);
          return s.includes(",") || s.includes('"')
            ? `"${s.replace(/"/g, '""')}"`
            : s;
        })
        .join(",")
    )
    .join("\n");
  return `${header}\n${body}`;
}

const AUDIT_LOG_COLUMNS = [
  { key: "id", label: "ID" },
  { key: "action", label: "Action" },
  { key: "actorType", label: "Actor Type" },
  { key: "actorId", label: "Actor ID" },
  { key: "actorLabel", label: "Actor Label" },
  { key: "entityType", label: "Entity Type" },
  { key: "entityId", label: "Entity ID" },
  { key: "projectId", label: "Project ID" },
  { key: "createdAt", label: "Created At" },
];

async function sendWithRetry(
  resend: Resend,
  options: {
    from: string;
    to: string;
    subject: string;
    html: string;
    text: string;
    attachments: { filename: string; content: string; content_type: string }[];
  }
): Promise<{ ok: boolean; error?: string }> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const result = await resend.emails.send(options);
      if (result.error) {
        const msg = result.error.message ?? "Resend returned an error";
        console.error(`[audit-retention] email attempt ${attempt}/2 failed:`, msg);
        if (attempt === 2) return { ok: false, error: msg };
        continue;
      }
      return { ok: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[audit-retention] email attempt ${attempt}/2 threw:`, msg);
      if (attempt === 2) return { ok: false, error: msg };
    }
  }
  return { ok: false, error: "unreachable" };
}

export interface PurgeResult {
  auditRowsExported: number;
  auditRowsDeleted: number;
  notificationRowsDeleted: number;
  emailSent: boolean;
  emailSkippedReason?: string;
  capped?: boolean;
}

export async function purgeAuditAndNotificationLogs(): Promise<PurgeResult> {
  const now = new Date();

  const [auditRetentionRaw, notifRetentionRaw, lastPurgeAtRaw] = await Promise.all([
    getSetting("audit_retention_days"),
    getSetting("notification_retention_days"),
    getSetting("last_audit_purge_at"),
  ]);

  const auditRetentionDays = parseRetentionDays(auditRetentionRaw, DEFAULT_AUDIT_RETENTION_DAYS);
  const notifRetentionDays = parseRetentionDays(notifRetentionRaw, DEFAULT_NOTIFICATION_RETENTION_DAYS);
  const lastPurgeAt = lastPurgeAtRaw ? new Date(lastPurgeAtRaw) : null;
  const isFirstRun = !lastPurgeAt;

  const auditCutoff = new Date(now.getTime() - auditRetentionDays * 86400000);
  const notifCutoff = new Date(now.getTime() - notifRetentionDays * 86400000);

  console.log(
    `[audit-retention] auditRetentionDays=${auditRetentionDays} notifRetentionDays=${notifRetentionDays} cutoff=${auditCutoff.toISOString()} lastPurgeAt=${lastPurgeAt?.toISOString() ?? "null"} isFirstRun=${isFirstRun}`
  );

  const auditWhere: Record<string, unknown> = { createdAt: { lt: auditCutoff } };

  let auditRows = await db.auditLog.findMany({
    where: auditWhere,
    orderBy: { createdAt: "asc" },
    take: isFirstRun ? MAX_FIRST_RUN_ROWS + 1 : undefined,
    select: {
      id: true,
      action: true,
      actorType: true,
      actorId: true,
      actorLabel: true,
      entityType: true,
      entityId: true,
      projectId: true,
      createdAt: true,
    },
  });

  let capped = false;
  if (isFirstRun && auditRows.length > MAX_FIRST_RUN_ROWS) {
    auditRows = auditRows.slice(0, MAX_FIRST_RUN_ROWS);
    capped = true;
    console.warn(
      `[audit-retention] FIRST RUN CAPPED: exporting ${MAX_FIRST_RUN_ROWS} rows (more exist). Remaining rows will be picked up in subsequent runs.`
    );
  }

  const auditIds = auditRows.map((r) => r.id);
  let auditRowsDeleted = 0;
  let emailSent = false;
  let emailSkippedReason: string | undefined;

  if (auditIds.length > 0) {
    const csv = rowsToCsv(auditRows, AUDIT_LOG_COLUMNS);
    const csvBase64 = Buffer.from(csv, "utf-8").toString("base64");
    const dateStamp = now.toISOString().slice(0, 10);
    const filename = `audit-log-export-${dateStamp}.csv`;

    const deleteResult = await db.auditLog.deleteMany({ where: { id: { in: auditIds } } });
    auditRowsDeleted = deleteResult.count;
    console.log(`[audit-retention] audit: exported ${auditRows.length} rows, deleted ${auditRowsDeleted}`);

    const owner = await db.admin.findFirst({ where: { role: "org_owner" } });
    if (!owner?.email) {
      console.warn("[audit-retention] audit: no org_owner found, email skipped");
      emailSkippedReason = "no org_owner found";
    } else {
      const resendApiKey = process.env.RESEND_API_KEY ?? "";
      if (!resendApiKey) {
        console.warn("[audit-retention] audit: RESEND_API_KEY not set, email skipped");
        emailSkippedReason = "RESEND_API_KEY not set";
      } else {
        const resend = new Resend(resendApiKey);
        const from = process.env.EMAIL_FROM ?? "Scheduler <notifications@eureka-ent.org>";
        const emailResult = await sendWithRetry(resend, {
          from,
          to: owner.email,
          subject: `Audit Log Export — ${dateStamp} (${auditRows.length} rows)`,
          html: `<p>Attached is the audit log export generated on ${dateStamp}.</p>
<p>Rows exported: ${auditRows.length}<br>
Retention threshold: ${auditRetentionDays} days<br>
Cutoff date: ${auditCutoff.toISOString().slice(0, 10)}${capped ? `<br><strong>Note:</strong> This was a first-run capped export (${MAX_FIRST_RUN_ROWS} rows max). Remaining rows will be exported in subsequent runs.` : ""}</p>`,
          text: `Audit Log Export — ${dateStamp}\n\nRows exported: ${auditRows.length}\nRetention threshold: ${auditRetentionDays} days\nCutoff date: ${auditCutoff.toISOString().slice(0, 10)}${capped ? `\n\nNote: This was a first-run capped export (${MAX_FIRST_RUN_ROWS} rows max). Remaining rows will be exported in subsequent runs.` : ""}`,
          attachments: [{ filename, content: csvBase64, content_type: "text/csv" }],
        });
        emailSent = emailResult.ok;
        if (!emailResult.ok) {
          console.error(
            `[audit-retention] audit: email failed after 2 attempts (${emailResult.error}). Rows were already deleted — data is not recoverable from this run.`
          );
          emailSkippedReason = `email failed: ${emailResult.error}`;
        }
      }
    }
  } else {
    console.log("[audit-retention] audit: nothing to purge");
  }

  const notifResult = await db.notificationLog.deleteMany({
    where: { createdAt: { lt: notifCutoff } },
  });
  console.log(`[audit-retention] notification: deleted ${notifResult.count} rows`);

  await setSetting("last_audit_purge_at", now.toISOString());

  return {
    auditRowsExported: auditRows.length,
    auditRowsDeleted,
    notificationRowsDeleted: notifResult.count,
    emailSent,
    emailSkippedReason,
    capped,
  };
}
