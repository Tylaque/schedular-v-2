import { auth } from "@/auth";
import Link from "next/link";
import { listTemplates } from "@/lib/data/templates";
import { listProjects } from "@/lib/data/projects";
import { ALL_CATEGORIES } from "@/lib/template-utils";
import TemplateListView from "@/components/TemplateListView";
import AdminNav from "@/components/AdminNav";

export const dynamic = "force-dynamic";

const AUDIENCE_BADGE: Record<string, string> = {
  admin: "bg-purple-100 text-purple-700",
  participant: "bg-blue-100 text-blue-700",
  super_admin: "bg-gray-100 text-gray-600",
};

export default async function AdminTemplatesPage({
  searchParams,
}: {
  searchParams: { projectId?: string };
}) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  const ownerId = role === "org_owner" ? undefined : session?.user?.id;
  const selectedProjectId = searchParams.projectId ?? "";
  const templates = await listTemplates(selectedProjectId || undefined);
  const projects = await listProjects(ownerId);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto p-6">
        <AdminNav current="/admin/templates" role={role} />

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Email Templates</h1>
            <p className="text-sm text-gray-500 mt-1">Manage system-wide and project-specific email templates.</p>
          </div>
          <Link
            href="/admin/templates/new"
            className="bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg px-4 py-2.5"
          >
            New template
          </Link>
        </div>

        <div className="mb-4">
          <label className="text-xs font-medium text-gray-500 mr-2">Scope:</label>
          <TemplateListView
            templates={templates}
            projects={projects.map((p) => ({ id: p.slug, name: p.name }))}
            selectedProjectId={selectedProjectId}
            AUDIENCE_BADGE={AUDIENCE_BADGE}
          />
        </div>

        <div className="overflow-x-auto border border-gray-200 rounded-lg bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Category</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Audience</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Subject</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Version</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Scope</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => {
                const catLabel = ALL_CATEGORIES.find((c) => c.value === t.category)?.label ?? t.category;
                const isPlaceholder = !t.id;
                return (
                  <tr key={t.category} className="border-b border-gray-200 last:border-b-0">
                    <td className="px-4 py-3 font-medium text-gray-900">{catLabel}</td>
                    <td className="px-4 py-3">
                      {t.audience ? (
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${AUDIENCE_BADGE[t.audience] ?? ""}`}>
                          {t.audience}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-700 max-w-xs truncate">
                      {isPlaceholder ? (
                        <span className="text-gray-400 italic">Not yet customized</span>
                      ) : (
                        t.subject
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {t.version > 0 ? `v${t.version}` : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {isPlaceholder ? (
                        <span className="text-xs text-gray-400">Global default</span>
                      ) : t.isGlobalDefault ? (
                        <span className="text-xs text-gray-400">Global default</span>
                      ) : (
                        <span className="text-xs text-brand-600 font-medium">Project override</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isPlaceholder ? (
                        <Link
                          href={`/admin/templates/new`}
                          className="text-brand-600 hover:text-brand-700 font-medium"
                        >
                          Create
                        </Link>
                      ) : (
                        <Link
                          href={`/admin/templates/${t.id}/edit`}
                          className="text-brand-600 hover:text-brand-700 font-medium"
                        >
                          Edit
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
