"use server";

import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createProject as dataCreateProject,
  getProjectBySlug,
  updateProject as dataUpdateProject,
} from "@/lib/data/projects";
import { canManageProject } from "@/lib/authz";
import { setAdminAvailabilityBulk } from "@/lib/data/availability";
import { createBooking, cancelBooking } from "@/lib/data/bookings";
import { joinWaitlist, claimWaitlistOffer } from "@/lib/data/waitlist";
import { createTemplateVersion } from "@/lib/data/templates";
import { sendTestEmail } from "@/lib/data/notifications";
import { inviteAssociate } from "@/lib/data/admins";
import { previewAdminUnavailable, commitAdminUnavailable, previewDateShift, commitDateShift } from "@/lib/data/bulk-reschedule";
import { canViewAllProjects } from "@/lib/authz";

export async function saveAvailabilityAction(
  projectId: string,
  adminId: string,
  entries: { dateKey: string; time: string; selected: boolean }[]
) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  // Only allow setting your own availability, or if you're a super_admin/org_owner
  const role = (session?.user as any)?.role;
  if (session.user.id !== adminId && !canViewAllProjects(role)) {
    throw new Error("Unauthorized");
  }
  await setAdminAvailabilityBulk(projectId, adminId, entries);
  revalidatePath(`/admin/availability/${projectId}`);
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
  ownerId?: string;
}) {
  const session = await auth();
  if (!session?.user?.id) return;

  const role = (session?.user as any)?.role;
  if (!canViewAllProjects(role)) return;

  const effectiveOwnerId = formData.ownerId ?? session?.user?.id;
  await dataCreateProject({ ...formData, ownerId: effectiveOwnerId });
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
  if (!input.projectId || !input.participantEmail) {
    return { ok: false, reason: "slot_full" };
  }
  const result = await createBooking(input);
  if (result.ok) {
    revalidatePath(`/book/${input.projectId}`);
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
    ownerId?: string;
  }
) {
  const session = await auth();
  if (!session?.user?.id) return;

  const role = (session?.user as any)?.role;
  const user = { id: session.user.id, role: role as "admin" | "super_admin" | "org_owner" };

  const project = await getProjectBySlug(slug);
  if (!project || !canManageProject(user, project)) {
    redirect("/admin/projects?error=unauthorized");
  }

  const effectiveOwnerId = role === "org_owner" ? formData.ownerId : session.user.id;
  await dataUpdateProject(slug, { ...formData, ownerId: effectiveOwnerId });
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
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  await createTemplateVersion(formData);
  revalidatePath("/admin/templates");
  if (formData.projectId) {
    revalidatePath(`/admin/templates/${formData.projectId}/edit`);
  }
}

export async function cancelBookingAction(bookingId: string, projectId?: string) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  await cancelBooking(bookingId);
  revalidatePath("/admin/calendar");
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/my-dashboard");
  if (projectId) {
    revalidatePath(`/admin/projects/${projectId}/edit`);
  }
}

export async function joinWaitlistAction(input: {
  projectId: string;
  name: string;
  email: string;
  dateKey?: string;
  time?: string;
}) {
  if (!input.projectId || !input.email || !input.name) {
    throw new Error("Missing required fields");
  }
  await joinWaitlist(input);
  revalidatePath(`/book/${input.projectId}`);
}

export async function claimWaitlistOfferAction(entryId: string) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  const result = await claimWaitlistOffer(entryId);
  if (result.ok) {
    revalidatePath("/admin/waitlist");
  }
  return result;
}

export async function previewAdminUnavailableAction(adminId: string, fromDate: string, toDate: string) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return previewAdminUnavailable(adminId, fromDate, toDate);
}

export async function commitAdminUnavailableAction(adminId: string, fromDate: string, toDate: string) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  const result = await commitAdminUnavailable(adminId, fromDate, toDate);
  revalidatePath("/admin/calendar");
  revalidatePath("/admin/bulk-reschedule");
  return result;
}

export async function previewDateShiftAction(projectId: string, fromDate: string, toDate: string, offsetDays: number) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return previewDateShift(projectId, fromDate, toDate, offsetDays);
}

export async function commitDateShiftAction(projectId: string, fromDate: string, toDate: string, offsetDays: number) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  const result = await commitDateShift(projectId, fromDate, toDate, offsetDays);
  revalidatePath("/admin/calendar");
  revalidatePath("/admin/bulk-reschedule");
  return result;
}

export async function sendTestAction(templateId: string, recipientEmail: string) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  await sendTestEmail(templateId, recipientEmail);
  revalidatePath(`/admin/templates/${templateId}/edit`);
}

export async function inviteAssociateAction(input: {
  name: string;
  email: string;
  projectId?: string;
}): Promise<{ id: string; name: string; initials: string; email: string; accountType: string | null; role: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/signin");
  }

  const role = (session?.user as any)?.role;
  if (!canViewAllProjects(role)) {
    redirect("/admin/my-area");
  }

  const admin = await inviteAssociate(input);
  revalidatePath("/admin/projects");
  if (input.projectId) {
    revalidatePath(`/admin/projects/${input.projectId}/edit`);
  }
  return admin;
}
