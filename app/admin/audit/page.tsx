import { auth } from "@/auth";

import { listAuditLogs } from "@/lib/data/audit";
import { listProjects } from "@/lib/data/projects";
import type { AuditAction } from "@prisma/client";

export const dynamic = "force-dynamic";

const ACTION_LABEL: Record<string, string> = {
  project_created: "Project Created",
  project_updated: "Project Updated",
  admin_availability_submitted: "Availability Submitted",
  booking_created: "Booking Created",
  booking_cancelled: "Booking Cancelled",
  booking_rescheduled: "Booking Rescheduled",
  template_created: "Template Created",
  template_updated: "Template Updated",
  notification_sent: "Test Notification Sent",
  role_changed: "Role Changed",
  org_ownership_transferred: "Ownership Transferred",
};

const ACTION_BADGE: Record<string, string> = {
  project_created: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  project_updated: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  admin_availability_submitted: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  booking_created: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  booking_cancelled: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  booking_rescheduled: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  template_created: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
  template_updated: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  notification_sent: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200",
  role_changed: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  org_ownership_transferred: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
};

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string; action?: string; from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const session = await auth();
  const role = (session?.user as any)?.role;
  const ownerId = role === "org_owner" ? undefined : session?.user?.id;
  const projects = await listProjects(ownerId);

  const filters: Parameters<typeof listAuditLogs>[0] = {};
  if (sp.projectId) filters.projectId = sp.projectId;
  if (sp.action) filters.action = sp.action as AuditAction;
  if (sp.from) filters.from = new Date(sp.from);
  if (sp.to) filters.to = new Date(sp.to);
  if (ownerId) filters.ownerId = ownerId;

  const logs = await listAuditLogs(filters);

  return (
    <div className="max-w-6xl mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-50">Audit Log
            {logs.length > 0 && (
              <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full bg-gray-100 text-xs font-semibold text-gray-500 leading-none ml-2 align-middle dark:bg-gray-800 dark:text-gray-400">
                {logs.length}
              </span>
            )}
          </h1>
          <p className="text-sm text-gray-500 mt-1 dark:text-gray-400">Captures every mutation across the platform.</p>
        </div>

        {/* Filters */}
        <form method="get" className="bg-white border border-gray-200 rounded-lg p-4 mb-6 flex flex-wrap gap-3 items-end shadow-sm dark:bg-gray-900 dark:border-gray-700">
          <div>
            <label htmlFor="project" className="block text-xs font-medium text-gray-500 mb-1 dark:text-gray-400">Project</label>
            <select
              id="project"
              name="projectId"
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm dark:border-gray-600"
              defaultValue={sp.projectId ?? ""}
            >
              <option value="">All projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="action" className="block text-xs font-medium text-gray-500 mb-1 dark:text-gray-400">Action</label>
            <select
              id="action"
              name="action"
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm dark:border-gray-600"
              defaultValue={sp.action ?? ""}
            >
              <option value="">All actions</option>
              {Object.entries(ACTION_LABEL).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <button type="submit" className="bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold rounded-lg px-4 py-1.5">
            Filter
          </button>
        </form>

        {/* Table */}
        <div className="overflow-x-auto border border-gray-200 rounded-lg bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-950">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase dark:text-gray-400">Timestamp</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase dark:text-gray-400">Action</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase dark:text-gray-400">Actor</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase dark:text-gray-400">Entity</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase dark:text-gray-400">Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400 dark:text-gray-500">
                    No audit entries match these filters.
                  </td>
                </tr>
              )}
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-gray-200 last:border-b-0 hover:bg-gray-50 transition-colors dark:border-gray-700 dark:hover:bg-gray-800">
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap dark:text-gray-400">
                    {new Date(log.createdAt).toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" })}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${ACTION_BADGE[log.action] ?? "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200"}`}>
                      {ACTION_LABEL[log.action] ?? log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-200">{log.actorLabel}</td>
                  <td className="px-4 py-3 text-gray-700 font-mono text-xs dark:text-gray-200">{log.entityType}:{log.entityId.slice(0, 8)}…</td>
                  <td className="px-4 py-3 text-gray-500 text-xs max-w-xs truncate dark:text-gray-400">
                    {log.afterState ? (
                      <span title={JSON.stringify(log.afterState)}>
                        {JSON.stringify(log.afterState).slice(0, 80)}
                        {JSON.stringify(log.afterState).length > 80 ? "…" : ""}
                      </span>
                    ) : (
                      <span className="text-gray-300 dark:text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
  );
}
