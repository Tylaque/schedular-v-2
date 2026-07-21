import { auth } from "@/auth";
import { listAllAdmins } from "@/lib/data/admins";
import AdminNav from "@/components/AdminNav";
import MyDashboardClient from "@/components/MyDashboardClient";
import type { AdminRecord } from "@/lib/data/admins";

export const dynamic = "force-dynamic";

export default async function MyDashboardPage() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  const admins: AdminRecord[] = await listAllAdmins();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto p-6">
        <AdminNav current="/admin/my-dashboard" role={role} />
        <h1 className="text-xl font-bold text-gray-900 mb-6">My Dashboard</h1>
        <MyDashboardClient admins={admins} />
      </div>
    </div>
  );
}
