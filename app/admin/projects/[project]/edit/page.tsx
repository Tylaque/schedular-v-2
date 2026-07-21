import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { getProjectBySlug } from "@/lib/data/projects";
import { canManageProject } from "@/lib/authz";
import ProjectForm from "@/components/ProjectForm";

export const dynamic = "force-dynamic";

export default async function EditProjectPage({
  params,
}: {
  params: { project: string };
}) {
  const session = await auth();
  if (!session?.user?.id) return notFound();

  const project = await getProjectBySlug(params.project);
  if (!project) return notFound();

  const user = { id: session.user.id, role: (session.user as any).role as "admin" | "super_admin" | "org_owner" };
  if (!canManageProject(user, project)) return notFound();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto p-6">
        <Link
          href="/admin/projects"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> Back to projects
        </Link>
        <h1 className="text-xl font-bold text-gray-900 mb-6">Edit project</h1>
        <ProjectForm mode="edit" initialProject={project} />
      </div>
    </div>
  );
}
