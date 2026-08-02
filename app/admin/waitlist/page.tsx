import { auth } from "@/auth";

import { listWaitlistForProject } from "@/lib/data/waitlist";
import { listProjects } from "@/lib/data/projects";
import WaitlistClient from "@/components/WaitlistClient";

export const dynamic = "force-dynamic";

export default async function AdminWaitlistPage({
  searchParams,
}: {
  searchParams: { projectId?: string };
}) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  const ownerId = role === "org_owner" ? undefined : session?.user?.id;
  const projects = await listProjects(ownerId);
  const projectId = searchParams.projectId ?? projects[0]?.id ?? "";
  const entries = projectId ? await listWaitlistForProject(projectId) : [];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-50">Waitlist</h1>
          <p className="text-sm text-gray-500 mt-1 dark:text-gray-400">Participants waiting for a slot to open up.</p>
        </div>

        <form method="get" className="bg-white border border-gray-200 rounded-lg p-4 mb-6 flex flex-wrap gap-3 items-end shadow-sm dark:bg-gray-900 dark:border-gray-700">
          <div>
            <label htmlFor="project" className="block text-xs font-medium text-gray-500 mb-1 dark:text-gray-400">Project</label>
            <select
              id="project"
              name="projectId"
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm dark:border-gray-600"
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

        <WaitlistClient entries={entries} />
      </div>
  );
}
