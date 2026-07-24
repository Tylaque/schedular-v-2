import { auth } from "@/auth";
import { isOrgOwner, isSuperAdmin } from "@/lib/authz";
import { getOwnerGraphStatus } from "@/lib/graph/tokens";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const adminId = url.searchParams.get("adminId");
  if (!adminId) {
    return Response.json({ status: null }, { status: 400 });
  }

  // Scope: admins can only check their own graph status;
  // super_admin and org_owner can check any admin's.
  const role = (session.user as any)?.role;
  if (!isOrgOwner(role) && !isSuperAdmin(role) && session.user.id !== adminId) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const status = await getOwnerGraphStatus(adminId).catch(() => null);
  if (!status) return Response.json({ status: "token_error" });

  if (status.connected) return Response.json({ status: "connected" });
  return Response.json({ status: status.reason });
}
