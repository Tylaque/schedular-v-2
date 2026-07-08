"use client";

import { useRouter } from "next/navigation";
import type { EmailTemplateWithDefault } from "@/lib/template-utils";

export default function TemplateListView({
  templates,
  projects,
  selectedProjectId,
  AUDIENCE_BADGE,
}: {
  templates: EmailTemplateWithDefault[];
  projects: { id: string; name: string }[];
  selectedProjectId: string;
  AUDIENCE_BADGE: Record<string, string>;
}) {
  const router = useRouter();

  return (
    <select
      value={selectedProjectId}
      onChange={(e) => {
        const val = e.target.value;
        router.push(val ? `/admin/templates?projectId=${val}` : "/admin/templates");
      }}
      className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white text-gray-700"
    >
      <option value="">Global defaults</option>
      {projects.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  );
}
