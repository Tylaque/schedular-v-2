import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import ProjectForm from "@/components/ProjectForm";

export default function NewProjectPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto p-6">
        <Link
          href="/admin/projects"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> Back to projects
        </Link>
        <h1 className="text-xl font-bold text-gray-900 mb-6">Create project</h1>
        <ProjectForm mode="create" />
      </div>
    </div>
  );
}
