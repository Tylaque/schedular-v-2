import { auth } from "@/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import AdminNav from "@/components/AdminNav";
import { listFlaggedBookings } from "@/lib/data/needs-attention";
import { canViewAllProjects } from "@/lib/authz";
import { db } from "@/lib/db";
import { isAdminEligibleForSlot } from "@/lib/data/bookings";
import NeedsAttentionClient from "@/components/NeedsAttentionClient";

export const dynamic = "force-dynamic";

export default async function NeedsAttentionPage() {
  const session = await auth();
  if (!session?.user?.id) notFound();

  const role = (session.user as any)?.role;
  if (!canViewAllProjects(role)) notFound();

  const ownerId = role === "org_owner" ? undefined : session.user.id;
  const flagged = await listFlaggedBookings(ownerId);

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
        );
        if (ok) eligible.push(admin);
      }

      return { ...b, eligibleAdmins: eligible };
    })
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto p-6">
        <AdminNav current="/admin/needs-attention" role={role} />
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Needs Attention
            </h1>
            <p className="text-sm text-gray-500 mt-1">
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
        {flaggedWithEligible.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
            <AlertTriangle className="w-8 h-8 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No bookings need manual attention.</p>
          </div>
        ) : (
          <NeedsAttentionClient flagged={flaggedWithEligible} />
        )}
      </div>
    </div>
  );
}
