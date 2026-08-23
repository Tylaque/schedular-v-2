import { auth } from "@/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { listFlaggedBookings, listFailedProvisionings } from "@/lib/data/needs-attention";
import { isOrgOwner, isSuperAdmin } from "@/lib/authz";
import { db } from "@/lib/db";
import { isAdminEligibleForSlot } from "@/lib/data/bookings";
import NeedsAttentionClient from "@/components/NeedsAttentionClient";

export const dynamic = "force-dynamic";

export default async function NeedsAttentionPage() {
  const session = await auth();
  if (!session?.user?.id) notFound();

  const role = (session.user as any)?.role;
  if (!isOrgOwner(role) && !isSuperAdmin(role)) notFound();

  const ownerId = role === "org_owner" ? undefined : session.user.id;
  const [flagged, failedProvisionings] = await Promise.all([
    listFlaggedBookings(ownerId),
    listFailedProvisionings(ownerId),
  ]);

  const flaggedWithEligible = await Promise.all(
    flagged.map(async (b) => {
      const booking = await db.booking.findUnique({
        where: { id: b.id },
        select: { projectId: true, dateKey: true, time: true, adminId: true },
      });
      if (!booking) return { ...b, eligibleAdmins: [] };

      const allAdmins = await db.admin.findMany({
        select: { id: true, name: true },
      });
      const candidates = allAdmins.filter((a) => a.id !== booking.adminId);

      const eligible: { id: string; name: string }[] = [];
      for (const admin of candidates) {
        const ok = await isAdminEligibleForSlot(
          booking.projectId,
          admin.id,
          booking.dateKey,
          booking.time,
          undefined,
          undefined,
          true,
        );
        if (ok) eligible.push(admin);
      }

      return { ...b, eligibleAdmins: eligible };
    })
  );

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2 dark:text-gray-50">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Needs Attention
          </h1>
          <p className="text-sm text-gray-500 mt-1 dark:text-gray-400">
            Bookings that require manual reassignment after an admin was removed from a project.
          </p>
        </div>
        <Link
          href="/admin/dashboard"
          className="text-sm text-brand-600 hover:text-brand-700 font-medium"
        >
          Dashboard
        </Link>
      </div>
      {flaggedWithEligible.length === 0 && failedProvisionings.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-12 text-center shadow-sm dark:bg-gray-900 dark:border-gray-700">
          <AlertTriangle className="w-8 h-8 text-gray-300 mx-auto mb-3 dark:text-gray-400" />
          <p className="text-sm text-gray-500 dark:text-gray-400">No items need attention.</p>
        </div>
      ) : (
        <NeedsAttentionClient flagged={flaggedWithEligible} failedProvisionings={failedProvisionings} />
      )}
    </div>
  );
}
