import { auth } from "@/auth";
import { redirect } from "next/navigation";
import TeamAvailabilityView from "@/components/TeamAvailabilityView";

export const dynamic = "force-dynamic";

export default async function TeamAvailabilityPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/signin");
  }
  const role = (session.user as any)?.role;
  if (role !== "org_owner" && role !== "super_admin") {
    redirect("/admin/projects");
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-xl font-bold text-gray-900 mb-1 dark:text-gray-50">Team Availability</h1>
      <p className="text-sm text-gray-500 mb-6 dark:text-gray-400">
        {role === "org_owner"
          ? "Availability submitted by every associate in the organisation, including super admins' own submissions."
          : "Availability submitted by associates on projects you own."}
      </p>
      <TeamAvailabilityView />
    </div>
  );
}
