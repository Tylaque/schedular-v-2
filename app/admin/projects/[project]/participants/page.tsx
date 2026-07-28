import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { getProjectBySlug } from "@/lib/data/projects";
import { listParticipantsForProject } from "@/lib/data/participants";
import { canManageProject } from "@/lib/authz";
import ParticipantsClient from "@/components/ParticipantsClient";

export const dynamic = "force-dynamic";

export default async function ParticipantsPage({
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

  const participants = await listParticipantsForProject(project.id);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        <Link
          href="/admin/projects"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> Back to projects
        </Link>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              Participants — {project.name}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Manage who receives a personalized booking link.
            </p>
          </div>
          <Link
            href={`/admin/projects/${params.project}/edit`}
            className="text-sm text-brand-600 hover:text-brand-700 font-medium"
          >
            Edit project
          </Link>
        </div>
        <ParticipantsClient
          participants={participants.map((p) => ({
            id: p.id,
            name: p.name,
            email: p.email,
            status: p.status,
            lastInvitedAt: p.lastInvitedAt,
            createdAt: p.createdAt,
          }))}
          projectId={project.id}
          projectSlug={project.slug}
          projectStatus={project.status}
        />
    </div>
  );
}
