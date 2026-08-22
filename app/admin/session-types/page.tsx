import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { listSessionTypes, ensureSeedSessionTypes } from "@/lib/data/session-types";
import SessionTypesClient from "@/components/SessionTypesClient";

export const dynamic = "force-dynamic";

export default async function SessionTypesPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/signin");
  }

  const role = (session.user as any)?.role;
  if (role !== "org_owner") {
    redirect("/admin/projects");
  }

  // Ensure the three starting session types exist
  await ensureSeedSessionTypes();
  const sessionTypes = await listSessionTypes();

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-xl font-bold text-gray-900 mb-1 dark:text-gray-50">Session Types</h1>
      <p className="text-sm text-gray-500 mb-6 dark:text-gray-400">
        Manage the session type catalog. Projects can set a default type, and bookings can optionally record an explicit type.
      </p>
      <SessionTypesClient sessionTypes={sessionTypes} />
    </div>
  );
}
