"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createProject as dataCreateProject,
  updateProject as dataUpdateProject,
} from "@/lib/data/projects";
import { setAdminAvailabilityBulk } from "@/lib/data/availability";
import { createBooking, cancelBooking } from "@/lib/data/bookings";
import { joinWaitlist, claimWaitlistOffer } from "@/lib/data/waitlist";
import { createTemplateVersion } from "@/lib/data/templates";
import { sendTestEmail } from "@/lib/data/notifications";

export async function saveAvailabilityAction(
  projectId: string,
  adminId: string,
  entries: { dateKey: string; time: string; selected: boolean }[]
) {
  await setAdminAvailabilityBulk(projectId, adminId, entries);
  revalidatePath("/admin/availability/[project]");
}

export async function createProjectAction(formData: {
  name: string;
  company: string;
  description: string;
  durationMinutes: number;
  dailyStart: string;
  dailyEnd: string;
  includeWeekends: boolean;
  minNoticeHours: number;
  timezone: string;
  bookingDeadlineDays: number;
  bufferMinutes: number;
  maxSessionsPerAdminPerDay: number;
  sessionCapacity: number;
  availabilityLockDate: Date;
  branding: { logoInitial: string; primaryColor: string; senderName: string };
  availabilityPeriodDays: number;
  adminIds: string[];
}) {
  await dataCreateProject(formData);
  revalidatePath("/admin/projects");
  redirect("/admin/projects");
}

export async function confirmBookingAction(input: {
  projectId: string;
  dateKey: string;
  time: string;
  participantName: string;
  participantEmail: string;
}): Promise<
  | { ok: true; adminName: string }
  | { ok: false; reason: "slot_full" | "no_admin_available" }
> {
  const result = await createBooking(input);
  if (result.ok) {
    revalidatePath("/book/[project]");
    return { ok: true, adminName: result.admin.name };
  }
  return result;
}

export async function updateProjectAction(
  slug: string,
  formData: {
    name: string;
    company: string;
    description: string;
    durationMinutes: number;
    dailyStart: string;
    dailyEnd: string;
    includeWeekends: boolean;
    minNoticeHours: number;
    timezone: string;
    bookingDeadlineDays: number;
    bufferMinutes: number;
    maxSessionsPerAdminPerDay: number;
    sessionCapacity: number;
    availabilityLockDate: Date;
    branding: { logoInitial: string; primaryColor: string; senderName: string };
    status: "draft" | "active" | "paused" | "closed" | "archived";
    availabilityPeriodDays: number;
    adminIds: string[];
  }
) {
  await dataUpdateProject(slug, formData);
  revalidatePath("/admin/projects");
  redirect("/admin/projects");
}

export async function saveTemplateAction(formData: {
  category: "admin_invitation" | "availability_request" | "participant_invitation" | "booking_confirmation" | "reminder_24h" | "reminder_1h" | "reschedule_notice" | "cancellation_notice" | "waitlist_offer";
  audience: "admin" | "participant" | "super_admin";
  projectId: string | null;
  subject: string;
  bodyHtml: string;
}) {
  await createTemplateVersion(formData);
  revalidatePath("/admin/templates");
  revalidatePath("/admin/templates/[id]/edit");
}

export async function cancelBookingAction(bookingId: string) {
  await cancelBooking(bookingId);
  revalidatePath("/admin/calendar");
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/my-dashboard");
}

export async function joinWaitlistAction(input: {
  projectId: string;
  name: string;
  email: string;
  dateKey?: string;
  time?: string;
}) {
  await joinWaitlist(input);
  revalidatePath("/book/[project]");
}

export async function claimWaitlistOfferAction(entryId: string) {
  const result = await claimWaitlistOffer(entryId);
  if (result.ok) {
    revalidatePath("/admin/waitlist");
  }
  return result;
}

export async function sendTestAction(templateId: string, recipientEmail: string) {
  await sendTestEmail(templateId, recipientEmail);
  revalidatePath("/admin/templates/[id]/edit");
}
