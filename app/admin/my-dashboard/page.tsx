import { auth } from "@/auth";
import { redirect } from "next/navigation";

import MyDashboardClient from "@/components/MyDashboardClient";

export const dynamic = "force-dynamic";

export default async function MyDashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/signin");
  }

  return <MyDashboardClient adminId={session.user.id} />;
}
