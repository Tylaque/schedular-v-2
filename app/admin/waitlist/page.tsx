import AdminNav from "@/components/AdminNav";
import { listWaitlistForProject } from "@/lib/data/waitlist";
import { listProjects } from "@/lib/data/projects";

export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<string, string> = {
  waiting: "bg-gray-100 text-gray-700",
  offered: "bg-amber-100 text-amber-700",
  expired: "bg-red-100 text-red-700",
  claimed: "bg-green-100 text-green-700",
  cancelled: "bg-gray-200 text-gray-500",
};

const STATUS_LABEL: Record<string, string> = {
  waiting: "Waiting",
  offered: "Offered",
  expired: "Expired",
  claimed: "Claimed",
  cancelled: "Cancelled",
};

export default async function AdminWaitlistPage({
  searchParams,
}: {
  searchParams: { projectId?: string };
}) {
  const projects = await listProjects();
  const projectId = searchParams.projectId ?? projects[0]?.id ?? "";
  const entries = projectId ? await listWaitlistForProject(projectId) : [];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-6">
        <AdminNav current="/admin/waitlist" />

        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">Waitlist</h1>
          <p className="text-sm text-gray-500 mt-1">Participants waiting for a slot to open up.</p>
        </div>

        <form method="get" className="bg-white border border-gray-200 rounded-lg p-4 mb-6 flex flex-wrap gap-3 items-end">
          <div>
            <label htmlFor="project" className="block text-xs font-medium text-gray-500 mb-1">Project</label>
            <select
              id="project"
              name="projectId"
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
              defaultValue={projectId}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <button type="submit" className="bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold rounded-lg px-4 py-1.5">
            Filter
          </button>
        </form>

        <div className="overflow-x-auto border border-gray-200 rounded-lg bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Joined</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Email</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Date / Time</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">
                    No waitlist entries for this project.
                  </td>
                </tr>
              )}
              {entries.map((entry) => (
                <tr key={entry.id} className="border-b border-gray-200 last:border-b-0">
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                    {new Date(entry.createdAt).toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" })}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{entry.name}</td>
                  <td className="px-4 py-3 text-gray-700">{entry.email}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {entry.dateKey ?? "—"}
                    {entry.time ? ` ${entry.time}` : ""}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[entry.status] ?? "bg-gray-100 text-gray-700"}`}>
                      {STATUS_LABEL[entry.status] ?? entry.status}
                    </span>
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
