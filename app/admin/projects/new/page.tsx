import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import ProjectForm from "@/components/ProjectForm";

export default function NewProjectPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        <Link
          href="/admin/projects"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <ArrowLeft className="w-4 h-4" /> Back to projects
        </Link>
        <h1 className="text-xl font-bold text-gray-900 mb-6 dark:text-gray-50">Create project</h1>
        <ProjectForm mode="create" />
    </div>
  );
}
