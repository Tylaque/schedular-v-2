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
import { isSessionInPast } from "@/lib/slotHelpers";
import { joinWaitlist, claimWaitlistOffer } from "@/lib/data/waitlist";
import { createTemplateVersion } from "@/lib/data/templates";
import { sendTestEmail } from "@/lib/data/notifications";
import { inviteAssociate } from "@/lib/data/admins";
import { previewAdminUnavailable, commitAdminUnavailable, previewDateShift, commitDateShift } from "@/lib/data/bulk-reschedule";
import { isOrgOwner, isSuperAdmin } from "@/lib/authz";
import { changeAdminRole, promoteToOrgOwner, deactivateAdmin, reactivateAdmin } from "@/lib/data/team";
import { setAdminRangesForDate } from "@/lib/data/availability-ranges";
import {
  createSessionType as dataCreateSessionType,
  updateSessionType as dataUpdateSessionType,
  softDeleteSessionType as dataSoftDeleteSessionType,
  reactivateSessionType as dataReactivateSessionType,
  ensureSeedSessionTypes,
  type ActorInfo,
} from "@/lib/data/session-types";
import { sendInvitationsOnActivation } from "@/lib/data/participants";
import { updateParticipantStatus } from "@/lib/data/participants";
import { addParticipant, sendParticipantInvitationsForProject, removeParticipant } from "@/lib/data/participants";
import { reassignBookingAdmin } from "@/lib/data/bookings";
import { recordAudit } from "@/lib/data/audit";
import {
  createCertification,
  updateCertification,
  deleteCertification,
  setAdminCertifications,
  setProjectCertificationRequirements,
} from "@/lib/data/certifications";
import type { CertificationRecord } from "@/lib/data/certifications";
import { createZoomAccount, setZoomAccountActive, deleteZoomAccount, syncZoomAccountsFromDirectory, listZoomPoolAccounts } from "@/lib/data/zoom";
import { listZoomPoolUsers, zoomPoolConfigured, getZoomPoolCredentials } from "@/lib/zoom/client";
import { upsertReminderSchedules, getReminderSchedules } from "@/lib/data/reminder-schedules";
import type { ReminderScheduleInput } from "@/lib/data/reminder-schedules";

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
  if (session.user.id !== adminId && !isOrgOwner(role) && !isSuperAdmin(role)) {
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
  certificationIds?: string[];
  autoCompleteBookings?: boolean;
  meetingPlatformPreference?: "zoom" | "teams" | "auto";
  assignmentMode?: "AUTO" | "PARTICIPANT_CHOICE";
  reminderSchedules?: ReminderScheduleInput[];
  defaultSessionTypeId?: string | null;
}) {
  const session = await auth();
  if (!session?.user?.id) return;

  const role = (session?.user as any)?.role;
  if (!isOrgOwner(role) && !isSuperAdmin(role)) return;

  if (formData.durationMinutes < 5 || formData.durationMinutes > 480) return;
  if (formData.availabilityPeriodDays < 1 || formData.availabilityPeriodDays > 365) return;

  const effectiveOwnerId = formData.ownerId ?? session?.user?.id;
  const created = await dataCreateProject({ ...formData, ownerId: effectiveOwnerId });
  if (formData.certificationIds && formData.certificationIds.length > 0) {
    await setProjectCertificationRequirements({
      projectId: created.id,
      certificationIds: [...new Set(formData.certificationIds)],
      actor: {
        actorId: session.user.id,
        actorLabel: certificationActorLabel(session.user),
      },
    });
  }
  if (formData.reminderSchedules && formData.reminderSchedules.length > 0) {
    await upsertReminderSchedules(created.id, formData.reminderSchedules);
  }
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
  adminId?: string;
  sessionTypeId?: string;
}): Promise<
  | { ok: true; adminName: string }
  | { ok: false; reason: "slot_full" | "no_admin_available" | "rate_limited" | "too_short_notice" | "admin_not_eligible" }
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
    autoCompleteBookings?: boolean;
    meetingPlatformPreference?: "zoom" | "teams" | "auto";
    assignmentMode?: "AUTO" | "PARTICIPANT_CHOICE";
    reminderSchedules?: ReminderScheduleInput[];
    defaultSessionTypeId?: string | null;
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

  if (formData.durationMinutes < 5 || formData.durationMinutes > 480) {
    return { ok: false, reason: "Duration must be 5–480 minutes." };
  }
  if (formData.availabilityPeriodDays < 1 || formData.availabilityPeriodDays > 365) {
    return { ok: false, reason: "Availability period must be 1–365 days." };
  }

  const effectiveOwnerId = role === "org_owner" ? formData.ownerId : session.user.id;
  const wasActive = project.status === "active";
  const result = await dataUpdateProject(slug, { ...formData, ownerId: effectiveOwnerId });
  if (formData.reminderSchedules) {
    await upsertReminderSchedules(project.id, formData.reminderSchedules);
  }
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
  category: "admin_invitation" | "availability_request" | "participant_invitation" | "booking_confirmation" | "reminder_24h" | "reminder_1h" | "reminder" | "reschedule_notice" | "cancellation_notice" | "waitlist_offer";
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

/**
 * Mark a session as completed.
 *
 * Server-side verification only: the caller must be the admin actually
 * assigned to the booking, the booking must be genuinely "awaiting
 * completion" (status confirmed, session time already past, project does
 * NOT auto-complete), and it must not have been completed already.
 */
export async function markBookingCompletedAction(
  bookingId: string
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, reason: "unauthorized" };

  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      adminId: true,
      status: true,
      dateKey: true,
      time: true,
      projectId: true,
      participantName: true,
      project: { select: { timezone: true, autoCompleteBookings: true } },
    },
  });
  if (!booking) return { ok: false, reason: "not_found" };
  if (booking.adminId !== session.user.id) return { ok: false, reason: "not_assigned" };
  if (booking.status !== "confirmed") return { ok: false, reason: "not_awaiting" };
  if (booking.project.autoCompleteBookings) return { ok: false, reason: "auto_completed" };
  if (!isSessionInPast(booking.dateKey, booking.time, booking.project.timezone)) {
    return { ok: false, reason: "not_in_past" };
  }

  await db.booking.update({
    where: { id: bookingId },
    data: { status: "completed" },
  });

  recordAudit({
    action: "booking_completed",
    actorType: "admin",
    actorId: session.user.id,
    actorLabel: certificationActorLabel(session.user),
    entityType: "Booking",
    entityId: bookingId,
    projectId: booking.projectId,
    beforeState: { status: "confirmed" },
    afterState: { status: "completed", participantName: booking.participantName, completedAt: new Date().toISOString() },
  }).catch(() => {});

  revalidatePath("/admin/my-area");
  revalidatePath("/admin/calendar");
  return { ok: true };
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
  const role = (session.user as any)?.role;
  if (!isOrgOwner(role) && !isSuperAdmin(role)) {
    const inScope = await db.projectAdmin.findFirst({
      where: { adminId, project: { ownerId: session.user.id } },
      select: { id: true },
    });
    if (!inScope) throw new Error("Forbidden");
  }
  return previewAdminUnavailable(adminId, fromDate, toDate);
}

export async function commitAdminUnavailableAction(adminId: string, fromDate: string, toDate: string) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  const role = (session.user as any)?.role;
  if (!isOrgOwner(role) && !isSuperAdmin(role)) {
    const inScope = await db.projectAdmin.findFirst({
      where: { adminId, project: { ownerId: session.user.id } },
      select: { id: true },
    });
    if (!inScope) throw new Error("Forbidden");
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
  const project = await db.project.findUnique({ where: { id: projectId }, select: { ownerId: true } });
  if (!project) throw new Error("Forbidden");
  const user = { id: session.user.id, role: (session.user as any)?.role as "admin" | "super_admin" | "org_owner" };
  if (!canManageProject(user, project)) throw new Error("Forbidden");
  return previewDateShift(projectId, fromDate, toDate, offsetDays);
}

export async function commitDateShiftAction(projectId: string, fromDate: string, toDate: string, offsetDays: number) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  const project = await db.project.findUnique({ where: { id: projectId }, select: { ownerId: true } });
  if (!project) throw new Error("Forbidden");
  const user = { id: session.user.id, role: (session.user as any)?.role as "admin" | "super_admin" | "org_owner" };
  if (!canManageProject(user, project)) throw new Error("Forbidden");
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
  role?: "admin" | "super_admin";
}): Promise<{ id: string; name: string; initials: string; email: string; accountType: string | null; role: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/signin");
  }

  const role = (session?.user as any)?.role;
  if (!isOrgOwner(role) && !isSuperAdmin(role)) {
    redirect("/admin/my-area");
  }

  // Only the org_owner may invite someone directly as a super_admin; a
  // super_admin inviting may only ever invite regular associates.
  const requestedRole = input.role ?? "admin";
  if (requestedRole === "super_admin" && !isOrgOwner(role)) {
    throw new Error("Only the organisation owner can invite a Super Admin.");
  }

  const hdrs = await headers();
  const ip = getClientIp(hdrs);
  if (!checkRateLimit(`invite:${ip}`, 10, 15 * 60 * 1000)) {
    throw new Error("Too many requests. Please try again later.");
  }

  const admin = await inviteAssociate({ ...input, role: requestedRole });
  revalidatePath("/admin/projects");
  revalidatePath("/admin/team");
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
        | "not_allowed"
        | "target_not_found"
        | "cannot_change_org_owner_role";
    }
> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, reason: "not_allowed" };
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

export async function deactivateAdminAction(
  targetAdminId: string
): Promise<
  | {
      ok: true;
      offboarding: { reassigned: number; flagged: number };
      projectsRemoved: number;
    }
  | {
      ok: false;
      reason:
        | "not_authorized"
        | "target_not_found"
        | "cannot_deactivate_self"
        | "cannot_deactivate_sole_org_owner";
    }
> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, reason: "not_authorized" };
  }
  const result = await deactivateAdmin(session.user.id, targetAdminId);
  if (result.ok) {
    revalidatePath("/admin/team");
    return {
      ok: true,
      offboarding: {
        reassigned: result.offboarding.reassigned.length,
        flagged: result.offboarding.flagged.length,
      },
      projectsRemoved: result.projectsRemoved.length,
    };
  }
  return result;
}

export async function reactivateAdminAction(
  targetAdminId: string
): Promise<{ ok: true } | { ok: false; reason: "not_authorized" | "target_not_found" }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, reason: "not_authorized" };
  }
  const result = await reactivateAdmin(session.user.id, targetAdminId);
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

// ---------------------------------------------------------------------------
// Certification catalog — org_owner only
// ---------------------------------------------------------------------------

function certificationActorLabel(user: { name?: string | null; email?: string | null }): string {
  return user.name ? `${user.name} <${user.email ?? ""}>` : user.email ?? "";
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002";
}

export async function createCertificationAction(
  name: string,
  description?: string
): Promise<{ ok: true; certification: CertificationRecord } | { ok: false; reason: string }> {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (!session?.user?.id || !isOrgOwner(role)) {
    return { ok: false, reason: "unauthorized" };
  }
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, reason: "Certification name is required." };
  try {
    const certification = await createCertification({
      name: trimmed,
      description,
      actorId: session.user.id,
      actorLabel: certificationActorLabel(session.user),
    });
    revalidatePath("/admin/certifications");
    revalidatePath("/admin/team");
    return { ok: true, certification };
  } catch (err) {
    if (isUniqueViolation(err)) {
      return { ok: false, reason: "A certification with this name already exists." };
    }
    return { ok: false, reason: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function updateCertificationAction(
  id: string,
  name: string,
  description?: string
): Promise<{ ok: true; certification: CertificationRecord } | { ok: false; reason: string }> {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (!session?.user?.id || !isOrgOwner(role)) {
    return { ok: false, reason: "unauthorized" };
  }
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, reason: "Certification name is required." };
  try {
    const certification = await updateCertification(id, {
      name: trimmed,
      description,
      actorId: session.user.id,
      actorLabel: certificationActorLabel(session.user),
    });
    if (!certification) return { ok: false, reason: "not_found" };
    revalidatePath("/admin/certifications");
    revalidatePath("/admin/team");
    return { ok: true, certification };
  } catch (err) {
    if (isUniqueViolation(err)) {
      return { ok: false, reason: "A certification with this name already exists." };
    }
    return { ok: false, reason: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function deleteCertificationAction(
  id: string
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (!session?.user?.id || !isOrgOwner(role)) {
    return { ok: false, reason: "unauthorized" };
  }
  const deleted = await deleteCertification(id, {
    actorId: session.user.id,
    actorLabel: certificationActorLabel(session.user),
  });
  if (!deleted) return { ok: false, reason: "not_found" };
  revalidatePath("/admin/certifications");
  revalidatePath("/admin/team");
  revalidatePath("/admin/projects");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Per-associate certification assignment
// ---------------------------------------------------------------------------

export async function setAdminCertificationsAction(
  adminId: string,
  certificationIds: string[]
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, reason: "unauthorized" };

  const role = (session?.user as any)?.role;
  // org_owner and super_admin can assign certifications to ANY associate
  // system-wide (super_admin via the Team page is a deliberate exception
  // to normal project-ownership scoping).
  const allowed = isOrgOwner(role) || isSuperAdmin(role);
  if (!allowed) return { ok: false, reason: "unauthorized" };

  const uniqueIds = [...new Set(certificationIds)];
  const valid = await db.certification.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true },
  });
  if (valid.length !== uniqueIds.length) {
    return { ok: false, reason: "One or more certifications no longer exist." };
  }

  await setAdminCertifications({
    adminId,
    certificationIds: uniqueIds,
    actor: {
      actorId: session.user.id,
      actorLabel: certificationActorLabel(session.user),
    },
  });
  revalidatePath("/admin/team");
  revalidatePath("/admin/projects");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Per-project required-certification declaration
// ---------------------------------------------------------------------------

export async function setProjectCertificationRequirementsAction(
  projectId: string,
  certificationIds: string[]
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, reason: "unauthorized" };

  const role = (session?.user as any)?.role;
  const user = { id: session.user.id, role: role as "admin" | "super_admin" | "org_owner" };
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { id: true, ownerId: true, slug: true },
  });
  if (!project || !canManageProject(user, project)) {
    return { ok: false, reason: "unauthorized" };
  }

  const uniqueIds = [...new Set(certificationIds)];
  const valid = await db.certification.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true },
  });
  if (valid.length !== uniqueIds.length) {
    return { ok: false, reason: "One or more certifications no longer exist." };
  }

  await setProjectCertificationRequirements({
    projectId,
    certificationIds: uniqueIds,
    actor: {
      actorId: session.user.id,
      actorLabel: certificationActorLabel(session.user),
    },
  });
  revalidatePath("/admin/projects");
  revalidatePath(`/admin/projects/${project.slug}/edit`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Session Types — org_owner only
// ---------------------------------------------------------------------------

function sessionTypeActor(session: { user: { name?: string | null; email?: string | null; id: string } }): ActorInfo {
  return {
    actorId: session.user.id,
    actorLabel: session.user.name || session.user.email || "Unknown",
  };
}

export async function createSessionTypeAction(
  name: string,
  description?: string,
  classification?: "STANDARD" | "FEEDBACK"
): Promise<
  | { ok: true; id: string; name: string; description: string; classification: string; isActive: boolean }
  | { ok: false; reason: string }
> {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (!session?.user?.id || !isOrgOwner(role)) {
    return { ok: false, reason: "unauthorized" };
  }
  if (!name?.trim()) {
    return { ok: false, reason: "Name is required." };
  }
  try {
    const record = await dataCreateSessionType({
      name,
      description,
      classification,
      ...sessionTypeActor(session as any),
    });
    revalidatePath("/admin/session-types");
    return { ok: true, ...record };
  } catch (e: any) {
    if (e?.code === "P2002") {
      return { ok: false, reason: "A session type with that name already exists." };
    }
    throw e;
  }
}

export async function updateSessionTypeAction(
  id: string,
  name: string,
  description?: string,
  classification?: "STANDARD" | "FEEDBACK"
): Promise<
  | { ok: true; id: string; name: string; description: string; classification: string; isActive: boolean }
  | { ok: false; reason: string }
> {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (!session?.user?.id || !isOrgOwner(role)) {
    return { ok: false, reason: "unauthorized" };
  }
  if (!name?.trim()) {
    return { ok: false, reason: "Name is required." };
  }
  const updated = await dataUpdateSessionType(id, {
    name,
    description,
    classification,
    ...sessionTypeActor(session as any),
  });
  if (!updated) {
    return { ok: false, reason: "Session type not found." };
  }
  revalidatePath("/admin/session-types");
  return { ok: true, ...updated };
}

export async function deleteSessionTypeAction(
  id: string
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (!session?.user?.id || !isOrgOwner(role)) {
    return { ok: false, reason: "unauthorized" };
  }
  const deleted = await dataSoftDeleteSessionType(id, sessionTypeActor(session as any));
  if (!deleted) {
    return { ok: false, reason: "Session type not found or already deactivated." };
  }
  revalidatePath("/admin/session-types");
  return { ok: true };
}

export async function reactivateSessionTypeAction(
  id: string
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (!session?.user?.id || !isOrgOwner(role)) {
    return { ok: false, reason: "unauthorized" };
  }
  const reactivated = await dataReactivateSessionType(id, sessionTypeActor(session as any));
  if (!reactivated) {
    return { ok: false, reason: "Session type not found or already active." };
  }
  revalidatePath("/admin/session-types");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Zoom account pool — super_admin / org_owner only
// ---------------------------------------------------------------------------

function canManageZoomPool(role: string): boolean {
  return isOrgOwner(role) || isSuperAdmin(role);
}

export async function createZoomAccountAction(input: {
  label: string;
  zoomUserId: string;
  zoomEmail: string;
}): Promise<{ ok: true; id: string } | { ok: false; reason: string }> {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (!session?.user?.id || !canManageZoomPool(role)) {
    return { ok: false, reason: "unauthorized" };
  }
  if (!input.label?.trim() || !input.zoomUserId?.trim() || !input.zoomEmail?.trim()) {
    return { ok: false, reason: "All fields are required." };
  }
  try {
    const account = await createZoomAccount({
      label: input.label.trim(),
      zoomUserId: input.zoomUserId.trim(),
      zoomEmail: input.zoomEmail.trim().toLowerCase(),
    });
    revalidatePath("/admin/zoom-pool");
    return { ok: true, id: account.id };
  } catch (err) {
    if (isUniqueViolation(err)) {
      return { ok: false, reason: "A pool account with that Zoom user ID or email already exists." };
    }
    return { ok: false, reason: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function setZoomAccountActiveAction(
  id: string,
  isActive: boolean
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (!session?.user?.id || !canManageZoomPool(role)) {
    return { ok: false, reason: "unauthorized" };
  }
  try {
    await setZoomAccountActive(id, isActive);
    revalidatePath("/admin/zoom-pool");
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function deleteZoomAccountAction(
  id: string
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (!session?.user?.id || !canManageZoomPool(role)) {
    return { ok: false, reason: "unauthorized" };
  }
  const bookings = await db.booking.count({ where: { zoomAccountId: id } });
  if (bookings > 0) {
    return { ok: false, reason: "This account has booking history — disable it instead of deleting." };
  }
  try {
    await deleteZoomAccount(id);
    revalidatePath("/admin/zoom-pool");
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function syncZoomPoolAction(): Promise<
  { ok: true; synced: number } | { ok: false; reason: string }
> {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (!session?.user?.id || !canManageZoomPool(role)) {
    return { ok: false, reason: "unauthorized" };
  }
  if (!zoomPoolConfigured()) {
    return { ok: false, reason: "Zoom Server-to-Server app is not configured (missing ZOOM_ACCOUNT_ID / ZOOM_CLIENT_ID / ZOOM_CLIENT_SECRET)." };
  }
  try {
    const users = await listZoomPoolUsers(getZoomPoolCredentials());
    const synced = await syncZoomAccountsFromDirectory(users);
    revalidatePath("/admin/zoom-pool");
    return { ok: true, synced };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function getZoomPoolStatusAction(): Promise<{
  configured: boolean;
  accountCount: number;
  activeCount: number;
}> {
  const accounts = await listZoomPoolAccounts();
  return {
    configured: zoomPoolConfigured(),
    accountCount: accounts.length,
    activeCount: accounts.filter((a) => a.isActive).length,
  };
}

export async function updateNotificationPreferencesAction(enabled: boolean): Promise<{ ok: boolean; reason?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, reason: "unauthorized" };
  try {
    await db.admin.update({
      where: { id: session.user.id },
      data: { notifyOnBooking: enabled },
    });
    revalidatePath("/admin/settings");
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "Unknown error" };
  }
}
