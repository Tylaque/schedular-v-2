import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import AdminNav from "@/components/AdminNav";
import AvailabilityRangePicker from "@/components/AvailabilityRangePicker";

export const dynamic = "force-dynamic";

export default async function MyAvailabilityPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/signin");
  }

  const role = (session.user as any)?.role;

  // Get the admin's assigned projects with their durations
  const adminProjects = await db.projectAdmin.findMany({
    where: { adminId: session.user.id },
    select: {
      project: {
        select: {
          id: true,
          name: true,
          durationMinutes: true,
        },
      },
    },
  });

  const projects = adminProjects.map((pa) => ({
    id: pa.project.id,
    name: pa.project.name,
    durationMinutes: pa.project.durationMinutes,
  }));

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto p-6">
        <AdminNav current="/admin/my-availability" role={role} />
        <AvailabilityRangePicker
          projects={projects}
        />
      </div>
    </div>
  );
}
