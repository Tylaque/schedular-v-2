"use client";

import type { ProjectHealthItem } from "@/lib/data/analytics";

const STATUS_STYLES: Record<string, string> = {
  active:
    "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/40 dark:border-emerald-800 dark:text-emerald-300",
  draft: "bg-gray-50 text-gray-700 border border-gray-200 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300",
  paused:
    "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/40 dark:border-amber-800 dark:text-amber-300",
  closed:
    "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-900/40 dark:border-rose-800 dark:text-rose-300",
  archived: "bg-gray-50 text-gray-500 border border-gray-200 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400",
};

export function ProjectHealthTable({ data }: { data: ProjectHealthItem[] }) {
  if (data.length === 0) {
    return (
      <div className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">
        No projects in the selected range.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
            <th className="pb-2 pr-4 font-medium">Project</th>
            <th className="pb-2 pr-4 font-medium">Status</th>
            <th className="pb-2 pr-4 text-right font-medium">Fill rate</th>
            <th className="pb-2 pr-4 text-right font-medium">Cancellation rate</th>
            <th className="pb-2 text-right font-medium">Waitlist</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {data.map((p) => (
            <tr key={p.projectId}>
              <td className="py-2.5 pr-4">
                <div className="font-medium text-gray-900 dark:text-gray-50">{p.projectName}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{p.projectSlug}</div>
              </td>
              <td className="py-2.5 pr-4">
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    STATUS_STYLES[p.status] ?? STATUS_STYLES.draft
                  }`}
                >
                  {p.status}
                </span>
              </td>
              <td className="py-2.5 pr-4 text-right tabular-nums text-gray-900 dark:text-gray-50">
                {Math.round(p.fillRate * 100)}%
              </td>
              <td className="py-2.5 pr-4 text-right tabular-nums text-gray-900 dark:text-gray-50">
                {Math.round(p.cancellationRate * 100)}%
              </td>
              <td className="py-2.5 text-right tabular-nums text-gray-900 dark:text-gray-50">
                {p.waitlistCount}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
