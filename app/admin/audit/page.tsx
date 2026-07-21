import { auth } from "@/auth";
import AdminNav from "@/components/AdminNav";
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
};

const ACTION_BADGE: Record<string, string> = {
  project_created: "bg-emerald-100 text-emerald-700",
  project_updated: "bg-blue-100 text-blue-700",
  admin_availability_submitted: "bg-purple-100 text-purple-700",
  booking_created: "bg-green-100 text-green-700",
  booking_cancelled: "bg-red-100 text-red-700",
  booking_rescheduled: "bg-amber-100 text-amber-700",
  template_created: "bg-indigo-100 text-indigo-700",
  template_updated: "bg-sky-100 text-sky-700",
  notification_sent: "bg-gray-100 text-gray-700",
};

export default async function AuditPage({
  searchParams,
}: {
  searchParams: { projectId?: string; action?: string; from?: string; to?: string };
}) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  const ownerId = role === "org_owner" ? undefined : session?.user?.id;
  const projects = await listProjects(ownerId);

  const filters: Parameters<typeof listAuditLogs>[0] = {};
  if (searchParams.projectId) filters.projectId = searchParams.projectId;
  if (searchParams.action) filters.action = searchParams.action as AuditAction;
  if (searchParams.from) filters.from = new Date(searchParams.from);
  if (searchParams.to) filters.to = new Date(searchParams.to);
  if (ownerId) filters.ownerId = ownerId;

  const logs = await listAuditLogs(filters);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-6">
        <AdminNav current="/admin/audit" role={role} />

        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">Audit Log</h1>
          <p className="text-sm text-gray-500 mt-1">Captures every mutation across the platform.</p>
        </div>

        {/* Filters */}
        <form method="get" className="bg-white border border-gray-200 rounded-lg p-4 mb-6 flex flex-wrap gap-3 items-end">
          <div>
            <label htmlFor="project" className="block text-xs font-medium text-gray-500 mb-1">Project</label>
            <select
              id="project"
              name="projectId"
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
              defaultValue={searchParams.projectId ?? ""}
            >
              <option value="">All projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="action" className="block text-xs font-medium text-gray-500 mb-1">Action</label>
            <select
              id="action"
              name="action"
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
              defaultValue={searchParams.action ?? ""}
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
        <div className="overflow-x-auto border border-gray-200 rounded-lg bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Timestamp</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Action</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Actor</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Entity</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">
                    No audit entries match these filters.
                  </td>
                </tr>
              )}
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-gray-200 last:border-b-0">
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" })}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${ACTION_BADGE[log.action] ?? "bg-gray-100 text-gray-700"}`}>
                      {ACTION_LABEL[log.action] ?? log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{log.actorLabel}</td>
                  <td className="px-4 py-3 text-gray-700 font-mono text-xs">{log.entityType}:{log.entityId.slice(0, 8)}…</td>
                  <td className="px-4 py-3 text-gray-500 text-xs max-w-xs truncate">
                    {log.afterState ? (
                      <span title={JSON.stringify(log.afterState)}>
                        {JSON.stringify(log.afterState).slice(0, 80)}
                        {JSON.stringify(log.afterState).length > 80 ? "…" : ""}
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
