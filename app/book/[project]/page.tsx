import { notFound } from "next/navigation";
import { getProjectBySlug } from "@/lib/data/projects";
import { getConsolidatedAvailability } from "@/lib/data/availability";
import BookingFlow from "@/components/BookingFlow";

export const dynamic = "force-dynamic";

export default async function BookPage({
  params,
}: {
  params: Promise<{ project: string }>;
}) {
  const { project: slug } = await params;
  const project = await getProjectBySlug(slug);
  if (!project) return notFound();

  const availability = await getConsolidatedAvailability(project.id);

  return <BookingFlow project={project} availability={availability} />;
}
