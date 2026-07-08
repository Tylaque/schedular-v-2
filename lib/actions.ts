"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createProject as dataCreateProject,
  updateProject as dataUpdateProject,
} from "@/lib/data/projects";
import { setAdminAvailabilityBulk } from "@/lib/data/availability";
import { createBooking } from "@/lib/data/bookings";

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
