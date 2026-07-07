import { notFound } from "next/navigation";
import { getProjectBySlug } from "@/lib/data/projects";
import AvailabilityGrid from "@/components/AvailabilityGrid";

export const dynamic = "force-dynamic";

export default async function AdminAvailabilityPage({
  params,
}: {
  params: { project: string };
}) {
  const project = await getProjectBySlug(params.project);
  if (!project) return notFound();

  return <AvailabilityGrid project={project} />;
}
