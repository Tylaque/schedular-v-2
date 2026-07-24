import { db } from "@/lib/db";
import { getValidGraphAccessToken } from "@/lib/graph/tokens";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

export function buildAdminConsentUrl(): string {
  const params = new URLSearchParams({
    client_id: process.env.AZURE_AD_CLIENT_ID!,
    redirect_uri: `${process.env.AUTH_URL ?? process.env.NEXTAUTH_URL!}/api/auth/callback/azure-ad`,
    response_type: "code",
    scope: "openid profile email offline_access User.Read Calendars.ReadWrite OnlineMeetings.ReadWrite",
  });
  return `https://login.microsoftonline.com/common/adminconsent?${params}`;
}

export interface BookingMeetingInfo {
  id: string;
  projectId: string;
  participantName: string;
  participantEmail: string;
  dateKey: string;
  time: string;
}

function toMeetingDateTime(dateKey: string, time: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day, hour, minute));
  return d.toISOString();
}

function toMeetingEndDateTime(dateKey: string, time: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day, hour, minute + 30));
  return d.toISOString();
}

export async function createMeetingEvent(
  ownerId: string,
  booking: BookingMeetingInfo,
): Promise<{
  teamsMeetingId: string;
  calendarEventId?: string;
  joinUrl?: string;
} | { error: "personal" | "insufficient_permissions" | "unknown"; detail?: string }> {
  const admin = await db.admin.findUnique({ where: { id: ownerId }, select: { accountType: true } });
  if (admin?.accountType === "personal") {
    return { error: "personal", detail: "Personal Microsoft accounts cannot host Teams meetings" };
  }

  const accessToken = await getValidGraphAccessToken(ownerId);
  if (!accessToken) {
    return { error: "insufficient_permissions", detail: "No valid Microsoft Graph token available" };
  }

  const start = toMeetingDateTime(booking.dateKey, booking.time);
  const end = toMeetingEndDateTime(booking.dateKey, booking.time);

  try {
    const meetingRes = await fetch(`${GRAPH_BASE}/me/onlineMeetings`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        startDateTime: start,
        endDateTime: end,
        subject: `Booking: ${booking.participantName}`,
      }),
    });

    if (!meetingRes.ok) {
      const errBody = await meetingRes.json().catch(() => ({}));
      const code = errBody?.error?.code ?? "";
      const message = errBody?.error?.message ?? `HTTP ${meetingRes.status}`;

      if (meetingRes.status === 403) {
        return { error: "insufficient_permissions", detail: message };
      }

      if (meetingRes.status === 400 && code === "AuthenticationError") {
        return { error: "personal", detail: message };
      }

      return { error: "unknown", detail: message };
    }

    const meeting = await meetingRes.json();

    const eventRes = await fetch(`${GRAPH_BASE}/me/events`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        subject: `Booking: ${booking.participantName}`,
        start: { dateTime: start, timeZone: "UTC" },
        end: { dateTime: end, timeZone: "UTC" },
        isOnlineMeeting: true,
        onlineMeetingProvider: "teamsForBusiness",
      }),
    });

    let calendarEventId: string | undefined;
    if (eventRes.ok) {
      const event = await eventRes.json();
      calendarEventId = event.id;
    }

    return {
      teamsMeetingId: meeting.id,
      calendarEventId,
      joinUrl: meeting.joinUrl,
    };
  } catch (err: any) {
    return { error: "unknown", detail: err?.message ?? String(err) };
  }
}

export async function deleteMeetingEvent(
  ownerId: string,
  teamsMeetingId: string,
): Promise<{ success: true } | { error: string }> {
  const accessToken = await getValidGraphAccessToken(ownerId);
  if (!accessToken) return { error: "No valid token" };

  try {
    const res = await fetch(`${GRAPH_BASE}/me/onlineMeetings/${teamsMeetingId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok && res.status !== 404) {
      return { error: `HTTP ${res.status}` };
    }

    return { success: true };
  } catch (err: any) {
    return { error: err?.message ?? String(err) };
  }
}

export async function updateMeetingEventTime(
  ownerId: string,
  booking: BookingMeetingInfo,
): Promise<{ success: true } | { error: "personal" | "insufficient_permissions" | "unknown"; detail?: string }> {
  const admin = await db.admin.findUnique({ where: { id: ownerId }, select: { accountType: true } });
  if (admin?.accountType === "personal") {
    return { error: "personal" };
  }

  const accessToken = await getValidGraphAccessToken(ownerId);
  if (!accessToken) return { error: "insufficient_permissions" };

  const start = toMeetingDateTime(booking.dateKey, booking.time);
  const end = toMeetingEndDateTime(booking.dateKey, booking.time);

  try {
    const res = await fetch(`${GRAPH_BASE}/me/events/${booking.id}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        start: { dateTime: start, timeZone: "UTC" },
        end: { dateTime: end, timeZone: "UTC" },
      }),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      return { error: "unknown", detail: errBody?.error?.message ?? `HTTP ${res.status}` };
    }

    return { success: true };
  } catch (err: any) {
    return { error: "unknown", detail: err?.message ?? String(err) };
  }
}
