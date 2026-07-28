import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AdminNav from "@/components/AdminNav";
import { countFlaggedBookings } from "@/lib/data/needs-attention";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const role = (session.user as any)?.role as string | undefined;
  const ownerId = role === "org_owner" ? undefined : session.user.id;
  const flaggedCount = await countFlaggedBookings(ownerId);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-4 sm:pt-6">
        <AdminNav role={role} flaggedCount={flaggedCount} />
      </div>
      {children}
    </div>
  );
}
