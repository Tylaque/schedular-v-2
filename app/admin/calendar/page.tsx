import { auth } from "@/auth";
import CalendarView from "@/components/CalendarView";
import { listProjects } from "@/lib/data/projects";
import { listAllAdmins } from "@/lib/data/admins";
import { dtScreenVars, pageTitleStyle, pageSubtitleStyle } from "@/lib/design-tokens";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  const ownerId = role === "org_owner" ? undefined : session?.user?.id;
  const projects = await listProjects(ownerId);
  const admins = await listAllAdmins();

  return (
    <div className="max-w-6xl mx-auto p-6" style={dtScreenVars()}>
      <div style={{ marginBottom: 20 }}>
        <h1 className="dt-text-primary" style={pageTitleStyle}>Calendar</h1>
        <p className="dt-text-secondary" style={{ ...pageSubtitleStyle, marginTop: 6 }}>
          Bookings across your projects.
        </p>
      </div>
      <div className="project-card project-card-static">
        <CalendarView
          projects={projects.map((p) => ({ id: p.id, name: p.name }))}
          admins={admins.map((a) => ({ id: a.id, name: a.name }))}
        />
      </div>
    </div>
  );
}
