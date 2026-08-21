import { notFound } from "next/navigation";
import { getProjectBySlug } from "@/lib/data/projects";
import { getConsolidatedAvailability } from "@/lib/data/availability";
import { getSlotAdminMap } from "@/lib/data/bookings";
import { getParticipantById } from "@/lib/data/participants";
import BookingFlow from "@/components/BookingFlow";

export const dynamic = "force-dynamic";

export default async function PersonalizedBookPage({
  params,
}: {
  params: Promise<{ project: string; participantId: string }>;
}) {
  const { project: slug, participantId } = await params;
  const project = await getProjectBySlug(slug);
  if (!project) return notFound();

  const participant = await getParticipantById(participantId);
  if (!participant) return notFound();

  if (participant.projectId !== project.id) return notFound();

  const availability = await getConsolidatedAvailability(project.id);

  const slotAdminMap =
    project.assignmentMode === "PARTICIPANT_CHOICE"
      ? await getSlotAdminMap(project.id, availability)
      : undefined;

  return (
    <BookingFlow
      project={project}
      availability={availability}
      slotAdminMap={slotAdminMap}
      prefillName={participant.name}
      prefillEmail={participant.email}
      participantId={participant.id}
    />
  );
}
