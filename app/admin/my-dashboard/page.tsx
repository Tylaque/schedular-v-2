import { auth } from "@/auth";
import { redirect } from "next/navigation";

import MyDashboardClient from "@/components/MyDashboardClient";

export const dynamic = "force-dynamic";

export default async function MyDashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/signin");
  }

  const role = (session.user as any)?.role;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        <h1 className="text-xl font-bold text-gray-900 mb-6 dark:text-gray-50">My Dashboard</h1>
        <MyDashboardClient adminId={session.user.id} />
      </div>
  );
}
