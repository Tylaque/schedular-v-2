import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import ProjectForm from "@/components/ProjectForm";
import { auth } from "@/auth";
import { listCertifications, getCertificationAssignments } from "@/lib/data/certifications";
import { listSessionTypes } from "@/lib/data/session-types";

export const dynamic = "force-dynamic";

export default async function NewProjectPage() {
  const session = await auth();
  const currentUserRole = (session?.user as any)?.role;

  const [certifications, assignments, sessionTypes] = await Promise.all([
    listCertifications(),
    getCertificationAssignments(),
    listSessionTypes(),
  ]);
  const certificationsByAdmin: Record<string, string[]> = {};
  for (const a of assignments) {
    (certificationsByAdmin[a.adminId] ??= []).push(a.certificationId);
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        <Link
          href="/admin/projects"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <ArrowLeft className="w-4 h-4" /> Back to projects
        </Link>
        <h1 className="text-xl font-bold text-gray-900 mb-6 dark:text-gray-50">Create project</h1>
        <ProjectForm
          mode="create"
          currentUserRole={currentUserRole}
          certifications={certifications}
          certificationsByAdmin={certificationsByAdmin}
          sessionTypes={sessionTypes}
        />
    </div>
  );
}
