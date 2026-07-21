import { auth } from "@/auth";
import { NextResponse } from "next/server";

export const GET = auth(async (req) => {
  if (!req.auth) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const token = (req.auth.user as any)?.access_token as string | undefined;
  if (!token) {
    return NextResponse.json({ error: "No access token" }, { status: 400 });
  }

  // Call Microsoft Graph /me to verify token works
  const graphRes = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!graphRes.ok) {
    const body = await graphRes.text();
    return NextResponse.json({ error: "Graph call failed", status: graphRes.status, body }, { status: 500 });
  }

  const me = await graphRes.json();
  return NextResponse.json({
    displayName: me.displayName,
    userPrincipalName: me.userPrincipalName,
    id: me.id,
  });
});
