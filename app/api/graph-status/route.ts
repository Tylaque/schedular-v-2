import { getOwnerGraphStatus } from "@/lib/graph/tokens";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const adminId = url.searchParams.get("adminId");
  if (!adminId) {
    return Response.json({ status: null }, { status: 400 });
  }

  const status = await getOwnerGraphStatus(adminId).catch(() => null);
  if (!status) return Response.json({ status: "token_error" });

  if (status.connected) return Response.json({ status: "connected" });
  return Response.json({ status: status.reason });
}
