import { auth } from "@/auth";
import Link from "next/link";
import { listProjects } from "@/lib/data/projects";
import type { ProjectWithAdmins } from "@/lib/data/projects";
import { getOwnerGraphStatus } from "@/lib/graph/tokens";
import { GraphStatusBadge } from "@/components/GraphStatusBadge";
import AdminNav from "@/components/AdminNav";

export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  active: "bg-emerald-100 text-emerald-700",
  paused: "bg-amber-100 text-amber-700",
  closed: "bg-red-100 text-red-700",
  archived: "bg-gray-100 text-gray-400",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
        STATUS_BADGE[status] ?? "bg-gray-100 text-gray-600"
      }`}
    >
      {status}
    </span>
  );
}

export default async function AdminProjectsPage() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  const ownerId = role === "org_owner" ? undefined : session?.user?.id;
  const projects = await listProjects(ownerId);

  const uniqueOwnderIds = [...new Set(projects.map((p) => p.ownerId).filter(Boolean))] as string[];
  const statuses = await Promise.all(
    uniqueOwnderIds.map((oid) => getOwnerGraphStatus(oid).catch(() => null))
  );
  const ownerStatusMap = new Map<string, Awaited<ReturnType<typeof getOwnerGraphStatus>> | null>();
  uniqueOwnderIds.forEach((oid, i) => ownerStatusMap.set(oid, statuses[i]));

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto p-6">
        <AdminNav current="/admin/projects" role={role} />

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Projects</h1>
            <p className="text-sm text-gray-500 mt-1">Manage your scheduling projects.</p>
          </div>
          <Link
            href="/admin/projects/new"
            className="bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg px-4 py-2.5"
          >
            New project
          </Link>
        </div>

        {/* Empty state */}
        {projects.length === 0 && (
          <div className="text-center py-16">
            <p className="text-sm text-gray-500 mb-4">No projects yet.</p>
            <Link
              href="/admin/projects/new"
              className="bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg px-4 py-2.5"
            >
              New project
            </Link>
          </div>
        )}

        {/* Project table */}
        {projects.length > 0 && (
          <div className="overflow-x-auto border border-gray-200 rounded-lg bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Owner</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Admins</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Lock date</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => (
                  <tr key={p.slug} className="border-b border-gray-200 last:border-b-0">
                    <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                    <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <span className="text-gray-500">{p.ownerName ?? "—"}</span>
                        {(() => {
                          const s = p.ownerId ? ownerStatusMap.get(p.ownerId) : undefined;
                          const badgeStatus = s?.connected ? "connected" : (s?.reason ?? null);
                          return badgeStatus ? <GraphStatusBadge status={badgeStatus as any} /> : null;
                        })()}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{p.admins.length}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {p.availabilityLockDate.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/projects/${p.slug}/edit`}
                        className="text-brand-600 hover:text-brand-700 font-medium"
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
