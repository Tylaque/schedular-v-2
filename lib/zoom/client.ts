// Zoom Server-to-Server OAuth client.
//
// The whole Zoom account pool is authenticated by ONE account-level app
// credential set (ZOOM_ACCOUNT_ID / ZOOM_CLIENT_ID / ZOOM_CLIENT_SECRET) using
// Zoom's Server-to-Server OAuth flow (grant_type=account_credentials). Pool
// ZoomAccount rows only reference licensed Zoom users — they hold no tokens.
//
// All HTTP calls route through the injected `fetcher` so verification can run
// against a mocked Zoom API without real credentials.

export type ZoomHttpFetcher = (
  input: string,
  init?: RequestInit
) => Promise<Response>;

const defaultFetcher: ZoomHttpFetcher = (input, init) => fetch(input, init);

export interface ZoomPoolCredentials {
  accountId?: string;
  clientId?: string;
  clientSecret?: string;
}

export function getZoomPoolCredentials(): ZoomPoolCredentials {
  return {
    accountId: process.env.ZOOM_ACCOUNT_ID,
    clientId: process.env.ZOOM_CLIENT_ID,
    clientSecret: process.env.ZOOM_CLIENT_SECRET,
  };
}

export function zoomPoolConfigured(creds?: ZoomPoolCredentials): boolean {
  const c = creds ?? getZoomPoolCredentials();
  return Boolean(c.accountId && c.clientId && c.clientSecret);
}

function zoomBase(): string {
  return process.env.ZOOM_API_BASE ?? "https://api.zoom.us";
}

let tokenCache: { token: string; expiresAt: number } | null = null;

/**
 * Returns a valid access token, reusing a cached one until ~30s before expiry.
 */
export async function getZoomAccessToken(
  creds?: ZoomPoolCredentials,
  fetcher: ZoomHttpFetcher = defaultFetcher
): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt) return tokenCache.token;

  const c = creds ?? getZoomPoolCredentials();
  if (!c.accountId || !c.clientId || !c.clientSecret) {
    throw new Error(
      "Zoom Server-to-Server app is not configured (ZOOM_ACCOUNT_ID / ZOOM_CLIENT_ID / ZOOM_CLIENT_SECRET)"
    );
  }

  const body = new URLSearchParams({
    grant_type: "account_credentials",
    account_id: c.accountId,
  });

  const res = await fetcher(`${zoomBase()}/oauth/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${c.clientId}:${c.clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Zoom token request failed: HTTP ${res.status}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in?: number };
  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + ((data.expires_in ?? 3600) - 30) * 1000,
  };
  return tokenCache.token;
}

export interface ZoomUser {
  id: string;
  email: string;
  displayName: string;
}

export async function listZoomPoolUsers(
  creds?: ZoomPoolCredentials,
  fetcher: ZoomHttpFetcher = defaultFetcher
): Promise<ZoomUser[]> {
  const token = await getZoomAccessToken(creds, fetcher);
  const res = await fetcher(`${zoomBase()}/v2/users?status=active&page_size=300`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Zoom users request failed: HTTP ${res.status}`);
  }
  const data = (await res.json()) as {
    users?: { id: string; email: string; first_name?: string; last_name?: string }[];
  };
  return (data.users ?? []).map((u) => ({
    id: u.id,
    email: u.email,
    displayName: `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() || u.email,
  }));
}

export interface ZoomMeetingInfo {
  id: string;
  joinUrl: string;
}

export type ZoomCreateResult =
  | { ok: true; meeting: ZoomMeetingInfo }
  | { ok: false; error: "auth_failed" | "api_error"; detail?: string };

export async function createZoomMeeting(
  input: {
    zoomUserId: string;
    topic: string;
    startTime: string; // ISO 8601 UTC
    durationMinutes: number;
  },
  creds?: ZoomPoolCredentials,
  fetcher: ZoomHttpFetcher = defaultFetcher
): Promise<ZoomCreateResult> {
  try {
    const token = await getZoomAccessToken(creds, fetcher);
    const res = await fetcher(`${zoomBase()}/v2/users/${input.zoomUserId}/meetings`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        topic: input.topic,
        type: 2,
        start_time: input.startTime,
        duration: input.durationMinutes,
        settings: {
          host_video: true,
          participant_video: true,
          join_before_host: true,
          auto_recording: "cloud",
        },
      }),
      cache: "no-store",
    });

    if (!res.ok) {
      return {
        ok: false,
        error: res.status === 401 ? "auth_failed" : "api_error",
        detail: `Zoom create meeting HTTP ${res.status}`,
      };
    }

    const data = (await res.json()) as { id: number; join_url?: string };
    return { ok: true, meeting: { id: String(data.id), joinUrl: data.join_url ?? "" } };
  } catch (err: any) {
    return { ok: false, error: "api_error", detail: err?.message ?? String(err) };
  }
}

export async function deleteZoomMeeting(
  meetingId: string,
  creds?: ZoomPoolCredentials,
  fetcher: ZoomHttpFetcher = defaultFetcher
): Promise<void> {
  const token = await getZoomAccessToken(creds, fetcher);
  await fetcher(`${zoomBase()}/v2/meetings/${meetingId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
}

export async function updateZoomMeetingTime(
  meetingId: string,
  startTime: string,
  durationMinutes: number,
  creds?: ZoomPoolCredentials,
  fetcher: ZoomHttpFetcher = defaultFetcher
): Promise<void> {
  const token = await getZoomAccessToken(creds, fetcher);
  await fetcher(`${zoomBase()}/v2/meetings/${meetingId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ start_time: startTime, duration: durationMinutes }),
    cache: "no-store",
  });
}
