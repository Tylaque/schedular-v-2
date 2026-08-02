"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import type { ProjectWithAdmins } from "@/lib/data/projects";
import { GraphStatusBadge } from "@/components/GraphStatusBadge";

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  paused: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  closed: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  archived: "bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[status] ?? "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"}`}
    >
      {status}
    </span>
  );
}

export default function ProjectsClient({
  projects,
  ownerStatusMap,
}: {
  projects: ProjectWithAdmins[];
  ownerStatusMap: Map<string, { connected: boolean; reason?: string | null } | null>;
}) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(
    () =>
      projects.filter((p) =>
        p.name.toLowerCase().includes(search.toLowerCase()),
      ),
    [projects, search],
  );

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2 dark:text-gray-50">
            Projects
            {projects.length > 0 && (
              <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full bg-gray-100 text-xs font-semibold text-gray-500 leading-none dark:bg-gray-800 dark:text-gray-400">
                {projects.length}
              </span>
            )}
          </h1>
          <p className="text-sm text-gray-500 mt-1 dark:text-gray-400">Manage your scheduling projects.</p>
        </div>
        <Link
          href="/admin/projects/new"
          className="bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg px-4 py-2.5"
        >
          New project
        </Link>
      </div>

      {projects.length === 0 && (
        <div className="text-center py-16">
          <p className="text-sm text-gray-500 mb-4 dark:text-gray-400">No projects yet.</p>
          <Link
            href="/admin/projects/new"
            className="bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg px-4 py-2.5"
          >
            New project
          </Link>
        </div>
      )}

      {projects.length > 0 && (
        <div>
          {projects.length > 5 && (
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search projects by name..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg bg-white dark:border-gray-600 dark:bg-gray-800"
              />
            </div>
          )}

          {filtered.length === 0 && search && (
            <div className="text-center py-8">
              <p className="text-sm text-gray-400 dark:text-gray-500">No projects match &quot;{search}&quot;.</p>
            </div>
          )}

          {filtered.length > 0 && (
            <div className="overflow-x-auto border border-gray-200 rounded-lg bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-950">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide dark:text-gray-400">Name</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide dark:text-gray-400">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide dark:text-gray-400">Owner</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide dark:text-gray-400">Admins</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide dark:text-gray-400">Lock date</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide dark:text-gray-400">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => (
                    <tr key={p.slug} className="border-b border-gray-200 last:border-b-0 hover:bg-gray-50 transition-colors dark:border-gray-700 dark:hover:bg-gray-800">
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-50">{p.name}</td>
                      <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <span className="text-gray-500 dark:text-gray-400">{p.ownerName ?? "—"}</span>
                          {(() => {
                            const s = p.ownerId ? ownerStatusMap.get(p.ownerId) : undefined;
                            const badgeStatus = s?.connected ? "connected" : (s?.reason ?? null);
                            return badgeStatus ? <GraphStatusBadge status={badgeStatus as any} /> : null;
                          })()}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{p.admins.length}</td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
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
      )}
    </div>
  );
}
