"use server";

import { auth } from "@/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { db } from "@/lib/db";
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
import { changeAdminRole, promoteToOrgOwner } from "@/lib/data/team";
import { setAdminRangesForDate } from "@/lib/data/availability-ranges";
import { sendInvitationsOnActivation } from "@/lib/data/participants";
import { updateParticipantStatus } from "@/lib/data/participants";
import { addParticipant, sendParticipantInvitationsForProject, removeParticipant } from "@/lib/data/participants";
import { reassignBookingAdmin } from "@/lib/data/bookings";
import { recordAudit } from "@/lib/data/audit";

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
  participantId?: string;
}): Promise<
  | { ok: true; adminName: string }
  | { ok: false; reason: "slot_full" | "no_admin_available" | "rate_limited" }
> {
  if (!input.projectId || !input.participantEmail) {
    return { ok: false, reason: "slot_full" };
  }

  const hdrs = await headers();
  const ip = getClientIp(hdrs);
  if (!checkRateLimit(`booking:${ip}`, 5, 15 * 60 * 1000)) {
    return { ok: false, reason: "rate_limited" };
  }

  const result = await createBooking(input);
  if (result.ok) {
    if (input.participantId) {
      updateParticipantStatus(input.participantId, "booked").catch(() => {});
    }
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
): Promise<{
  ok: true;
  reassigned: number;
  flagged: number;
  flaggedBookings: { bookingId: string; reason: string }[];
} | { ok: false; reason: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, reason: "unauthorized" };

  const role = (session?.user as any)?.role;
  const user = { id: session.user.id, role: role as "admin" | "super_admin" | "org_owner" };

  const project = await getProjectBySlug(slug);
  if (!project || !canManageProject(user, project)) {
    return { ok: false, reason: "unauthorized" };
  }

  const effectiveOwnerId = role === "org_owner" ? formData.ownerId : session.user.id;
  const wasActive = project.status === "active";
  const result = await dataUpdateProject(slug, { ...formData, ownerId: effectiveOwnerId });
  revalidatePath("/admin/projects");
  revalidatePath(`/admin/projects/${slug}/edit`);
  revalidatePath(`/admin/projects/${project.id}/participants`);
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/needs-attention");

  if (!wasActive && formData.status === "active") {
    sendInvitationsOnActivation(project.id).catch((err) => {
      console.error("Failed to send activation invitations:", err);
    });
  }

  return {
    ok: true,
    reassigned: result.offboarding.reassigned.length,
    flagged: result.offboarding.flagged.length,
    flaggedBookings: result.offboarding.flagged,
  };
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

  const hdrs = await headers();
  const ip = getClientIp(hdrs);
  if (!checkRateLimit(`waitlist:${ip}`, 5, 15 * 60 * 1000)) {
    throw new Error("Too many requests. Please try again later.");
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

  const hdrs = await headers();
  const ip = getClientIp(hdrs);
  if (!checkRateLimit(`invite:${ip}`, 10, 15 * 60 * 1000)) {
    throw new Error("Too many requests. Please try again later.");
  }

  const admin = await inviteAssociate(input);
  revalidatePath("/admin/projects");
  if (input.projectId) {
    revalidatePath(`/admin/projects/${input.projectId}/edit`);
  }
  return admin;
}

export async function changeAdminRoleAction(
  targetAdminId: string,
  newRole: "admin" | "super_admin"
): Promise<
  | { ok: true }
  | {
      ok: false;
      reason:
        | "not_org_owner"
        | "target_not_found"
        | "cannot_change_org_owner_role";
    }
> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, reason: "not_org_owner" };
  }
  const result = await changeAdminRole(session.user.id, targetAdminId, newRole);
  if (result.ok) {
    revalidatePath("/admin/team");
  }
  return result;
}

export async function promoteToOrgOwnerAction(
  targetAdminId: string,
  confirmationPhrase: string
): Promise<
  | { ok: true }
  | {
      ok: false;
      reason:
        | "not_org_owner"
        | "target_not_found"
        | "already_org_owner"
        | "confirmation_mismatch";
    }
> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, reason: "not_org_owner" };
  }
  const result = await promoteToOrgOwner(
    session.user.id,
    targetAdminId,
    confirmationPhrase
  );
  if (result.ok) {
    revalidatePath("/admin/team");
  }
  return result;
}

export async function saveAvailabilityRangesAction(
  dateKey: string,
  ranges: { startTime: string; endTime: string }[]
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, reason: "unauthorized" };
  }
  const result = await setAdminRangesForDate(session.user.id, dateKey, ranges);
  if (result.ok) {
    revalidatePath("/admin/my-availability");
  }
  return result;
}

export async function addParticipantAction(
  projectId: string,
  name: string,
  email: string
): Promise<
  | { ok: true; emailSent: boolean }
  | { ok: false; reason: string }
> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, reason: "unauthorized" };
  }
  const project = await db.project.findUnique({ where: { id: projectId }, select: { slug: true } });
  if (!project) {
    return { ok: false, reason: "project_not_found" };
  }
  try {
    const { emailSent } = await addParticipant(projectId, name, email);
    revalidatePath(`/admin/projects/${project.slug}/participants`);
    revalidatePath(`/admin/projects/${projectId}/participants`);
    return { ok: true, emailSent };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function sendInvitesNowAction(
  projectId: string,
  participantIds?: string[]
): Promise<
  | { ok: true; sent: number; failed: number }
  | { ok: false; reason: string }
> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, reason: "unauthorized" };
  }
  try {
    const result = await sendParticipantInvitationsForProject(projectId, participantIds);
    const project = await db.project.findUnique({ where: { id: projectId }, select: { slug: true } });
    if (project) {
      revalidatePath(`/admin/projects/${project.slug}/participants`);
    }
    return { ok: true, ...result };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function removeParticipantAction(
  participantId: string
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, reason: "unauthorized" };
  }
  try {
    await removeParticipant(participantId);
    revalidatePath("/admin/projects");
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function manuallyResolveFlaggedBookingAction(
  bookingId: string,
  newAdminId: string
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, reason: "unauthorized" };
  }

  const user = session.user as { name?: string | null; email?: string | null };
  const actorLabel = user.name
    ? `${user.name} <${user.email ?? ""}>`
    : user.email ?? session.user.id;

  const result = await reassignBookingAdmin(bookingId, newAdminId, session.user.id, actorLabel, true);
  if (!result.ok) {
    return { ok: false, reason: result.reason };
  }

  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    select: { projectId: true },
  });
  if (booking) {
    const alreadyOnProject = await db.projectAdmin.findUnique({
      where: { projectId_adminId: { projectId: booking.projectId, adminId: newAdminId } },
    });
    if (!alreadyOnProject) {
      await db.projectAdmin.create({
        data: { projectId: booking.projectId, adminId: newAdminId },
      });
    }
  }

  // Clear the manual attention flag
  await db.booking.update({
    where: { id: bookingId },
    data: { needsManualAttention: false, manualAttentionReason: null },
  });

  await recordAudit({
    action: "booking_rescheduled",
    actorType: "admin",
    actorId: session.user.id,
    actorLabel: `Manual reassignment: ${actorLabel}`,
    entityType: "Booking",
    entityId: bookingId,
    beforeState: { needsManualAttention: true, adminId: result.booking.adminId },
    afterState: { needsManualAttention: false, adminId: newAdminId },
  });

  revalidatePath("/admin/needs-attention");
  revalidatePath("/admin/dashboard");
  return { ok: true };
}
