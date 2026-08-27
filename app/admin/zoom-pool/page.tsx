import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { listZoomPoolAccounts } from "@/lib/data/zoom";
import { zoomPoolConfigured } from "@/lib/zoom/client";
import ZoomPoolClient from "@/components/ZoomPoolClient";

export const dynamic = "force-dynamic";

export default async function ZoomPoolPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/signin");
  }

  const role = (session.user as any)?.role;
  if (role !== "org_owner" && role !== "super_admin") {
    redirect("/admin/projects");
  }

  const accounts = await listZoomPoolAccounts();

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-xl font-bold text-gray-900 mb-1 dark:text-gray-50">Zoom Account Pool</h1>
      <p className="text-sm text-gray-500 mb-6 dark:text-gray-400">
        Shared licensed Zoom accounts that bookings are automatically assigned to.
      </p>
      <ZoomPoolClient
        accounts={accounts}
        configured={zoomPoolConfigured()}
      />
    </div>
  );
}
