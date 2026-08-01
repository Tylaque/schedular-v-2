import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AdminSidebar from "@/components/AdminSidebar";
import SessionTimeout from "@/components/SessionTimeout";
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
      <AdminSidebar role={role} flaggedCount={flaggedCount} />
      <div className="lg:pl-60 pt-14 lg:pt-0 min-h-screen">
          {children}
      </div>
      <SessionTimeout />
    </div>
  );
}
