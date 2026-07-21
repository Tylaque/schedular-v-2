import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getConsolidatedAvailability } from "@/lib/data/availability";
import { hoursUntilSession, isSessionInPast } from "@/lib/slotHelpers";
import ManageBooking from "./ManageBooking";

export const dynamic = "force-dynamic";

export default async function ManagePage({ params }: { params: { bookingId: string } }) {
  const booking = await db.booking.findUnique({
    where: { id: params.bookingId },
    include: {
      project: {
        select: {
          id: true, name: true, company: true, timezone: true, selfServiceWindowHours: true,
          durationMinutes: true, dailyStart: true, dailyEnd: true, includeWeekends: true,
          bufferMinutes: true, maxSessionsPerAdminPerDay: true, sessionCapacity: true,
          slug: true,
        },
      },
    },
  });

  if (!booking || booking.status !== "confirmed") return notFound();

  const { project } = booking;
  const inPast = isSessionInPast(booking.dateKey, booking.time, project.timezone);
  const hoursLeft = hoursUntilSession(booking.dateKey, booking.time, project.timezone);
  const windowOpen = !inPast && hoursLeft >= project.selfServiceWindowHours;

  const availability = await getConsolidatedAvailability(project.id);

  return (
    <ManageBooking
      booking={JSON.parse(JSON.stringify(booking))}
      project={JSON.parse(JSON.stringify(project))}
      availability={availability}
      inPast={inPast}
      windowOpen={windowOpen}
      hoursLeft={hoursLeft}
    />
  );
}
