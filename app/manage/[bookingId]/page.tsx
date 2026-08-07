import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getConsolidatedAvailability } from "@/lib/data/availability";
import { hoursUntilSession, isSessionInPast } from "@/lib/slotHelpers";
import { verifyManageToken } from "@/lib/manage-token";
import ManageBooking from "./ManageBooking";
import ManageBookingLocked from "./ManageBookingLocked";

export const dynamic = "force-dynamic";

export default async function ManagePage({
  params,
  searchParams,
}: {
  params: { bookingId: string };
  searchParams: { token?: string };
}) {
  // No booking data is queried or rendered until the participant proves
  // knowledge of the booking email (which issues a signed, expiring token).
  // A leaked /manage/<id> link alone therefore exposes nothing.
  const verified = searchParams.token ? verifyManageToken(searchParams.token) : null;
  if (!verified || verified.bookingId !== params.bookingId) {
    return <ManageBookingLocked bookingId={params.bookingId} />;
  }

  const booking = await db.booking.findUnique({
    where: { id: params.bookingId },
    select: {
      id: true,
      participantName: true,
      participantEmail: true,
      dateKey: true,
      time: true,
      meetingPlatform: true,
      teamsJoinUrl: true,
      zoomJoinUrl: true,
      meetingFallbackReason: true,
      status: true,
      project: {
        select: {
          id: true, name: true, company: true, timezone: true,
          selfServiceWindowHours: true, durationMinutes: true, slug: true,
        },
      },
    },
  });

  if (!booking || booking.status !== "confirmed") return notFound();

  // Defense-in-depth: the token is bound to this bookingId and to the email
  // recorded on the booking.
  if (booking.participantEmail.toLowerCase().trim() !== verified.email) return notFound();

  const { project } = booking;
  const inPast = isSessionInPast(booking.dateKey, booking.time, project.timezone);
  const hoursLeft = hoursUntilSession(booking.dateKey, booking.time, project.timezone);
  const windowOpen = !inPast && hoursLeft >= project.selfServiceWindowHours;

  const availability = await getConsolidatedAvailability(project.id);

  return (
    <ManageBooking
      booking={{
        id: booking.id,
        participantName: booking.participantName,
        participantEmail: booking.participantEmail,
        dateKey: booking.dateKey,
        time: booking.time,
        meetingPlatform: booking.meetingPlatform,
        teamsJoinUrl: booking.teamsJoinUrl,
        zoomJoinUrl: booking.zoomJoinUrl,
        meetingFallbackReason: booking.meetingFallbackReason,
      }}
      project={{
        name: project.name,
        company: project.company,
        timezone: project.timezone,
        selfServiceWindowHours: project.selfServiceWindowHours,
        durationMinutes: project.durationMinutes,
        slug: project.slug,
      }}
      availability={availability}
      inPast={inPast}
      windowOpen={windowOpen}
      hoursLeft={hoursLeft}
    />
  );
}
