import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { listTeamMembers } from "@/lib/data/team";
import TeamClient from "@/components/TeamClient";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/signin");
  }

  const role = (session.user as any)?.role;
  if (role !== "org_owner") {
    redirect("/admin/projects");
  }

  const members = await listTeamMembers();

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-xl font-bold text-gray-900 mb-6 dark:text-gray-50">Team Management</h1>
      <TeamClient members={members} currentUserId={session.user.id} />
    </div>
  );
}
