import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AdminNav from "@/components/AdminNav";
import MyDashboardClient from "@/components/MyDashboardClient";

export const dynamic = "force-dynamic";

export default async function MyDashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/signin");
  }

  const role = (session.user as any)?.role;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto p-6">
        <AdminNav current="/admin/my-dashboard" role={role} />
        <h1 className="text-xl font-bold text-gray-900 mb-6">My Dashboard</h1>
        <MyDashboardClient adminId={session.user.id} />
      </div>
    </div>
  );
}
