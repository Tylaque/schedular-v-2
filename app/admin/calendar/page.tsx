import { auth } from "@/auth";
import AdminNav from "@/components/AdminNav";
import CalendarView from "@/components/CalendarView";
import { listProjects } from "@/lib/data/projects";
import { listAllAdmins } from "@/lib/data/admins";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  const ownerId = role === "org_owner" ? undefined : session?.user?.id;
  const projects = await listProjects(ownerId);
  const admins = await listAllAdmins();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-6">
        <AdminNav current="/admin/calendar" role={role} />
        <h1 className="text-xl font-bold text-gray-900 mb-6">Calendar</h1>
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4">
          <CalendarView
            projects={projects.map((p) => ({ id: p.id, name: p.name }))}
            admins={admins.map((a) => ({ id: a.id, name: a.name }))}
          />
        </div>
      </div>
    </div>
  );
}
