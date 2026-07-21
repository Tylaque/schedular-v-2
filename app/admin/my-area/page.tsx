import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getAdminDashboardData } from "@/lib/data/dashboard";
import { FolderKanban, CalendarClock, Clock, CheckCircle2, Users } from "lucide-react";

export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<string, string> = {
  invited: "bg-gray-100 text-gray-600",
  link_sent: "bg-amber-100 text-amber-700",
  booked: "bg-blue-100 text-blue-700",
  reminded: "bg-purple-100 text-purple-700",
  completed: "bg-emerald-100 text-emerald-700",
  no_show: "bg-red-100 text-red-700",
  cancelled: "bg-gray-200 text-gray-500",
};

const STATUS_BADGE_PROJECT: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  active: "bg-emerald-100 text-emerald-700",
  paused: "bg-amber-100 text-amber-700",
  closed: "bg-red-100 text-red-700",
  archived: "bg-gray-100 text-gray-400",
};

export default async function MyAreaPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/signin");
  }

  const data = await getAdminDashboardData(session.user.id);
  if (!data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-sm text-gray-500">Your account is not fully set up yet. Please contact an administrator.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto p-6">
        <h1 className="text-xl font-bold text-gray-900 mb-6">My Area</h1>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4">
            <div className="flex items-center gap-2 text-gray-400 mb-1">
              <FolderKanban className="w-4 h-4" />
              <span className="text-xs font-medium">Assigned Projects</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">{data.assignedProjects.length}</div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4">
            <div className="flex items-center gap-2 text-gray-400 mb-1">
              <CalendarClock className="w-4 h-4" />
              <span className="text-xs font-medium">Availability Entries</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">{data.submittedAvailabilityCount}</div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4">
            <div className="flex items-center gap-2 text-gray-400 mb-1">
              <Clock className="w-4 h-4" />
              <span className="text-xs font-medium">Upcoming Sessions</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">{data.upcomingSessions.length}</div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4">
            <div className="flex items-center gap-2 text-gray-400 mb-1">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-medium">Completed Sessions</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">{data.completedSessions.length}</div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4 mb-8">
          <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <FolderKanban className="w-4 h-4 text-gray-400" /> Assigned Projects
          </h2>
          {data.assignedProjects.length === 0 ? (
            <p className="text-sm text-gray-400">No projects assigned.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {data.assignedProjects.map((p) => (
                <div key={p.id} className="border border-gray-200 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900 text-sm">{p.name}</span>
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_PROJECT[p.status] ?? ""}`}>
                      {p.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4 mb-8">
          <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-400" /> Upcoming Sessions ({data.upcomingSessions.length})
          </h2>
          {data.upcomingSessions.length === 0 ? (
            <p className="text-sm text-gray-400">No upcoming sessions.</p>
          ) : (
            <div className="space-y-2">
              {data.upcomingSessions.map((s) => (
                <div key={s.id} className="flex items-center justify-between border border-gray-100 rounded-lg p-2.5">
                  <div>
                    <span className="text-sm font-medium text-gray-900">{s.participantName}</span>
                    <span className="text-xs text-gray-400 ml-2">{s.projectName}</span>
                  </div>
                  <div className="text-xs text-gray-500">{s.dateKey} @ {s.time}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4 mb-8">
          <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-gray-400" /> Completed Sessions ({data.completedSessions.length})
          </h2>
          {data.completedSessions.length === 0 ? (
            <p className="text-sm text-gray-400">No completed sessions.</p>
          ) : (
            <div className="space-y-2">
              {data.completedSessions.map((s) => (
                <div key={s.id} className="flex items-center justify-between border border-gray-100 rounded-lg p-2.5 bg-gray-50">
                  <div>
                    <span className="text-sm font-medium text-gray-500">{s.participantName}</span>
                    <span className="text-xs text-gray-400 ml-2">{s.projectName}</span>
                  </div>
                  <div className="text-xs text-gray-400">{s.dateKey} @ {s.time}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Users className="w-4 h-4 text-gray-400" /> Participants ({data.relevantParticipants.length})
          </h2>
          {data.relevantParticipants.length === 0 ? (
            <p className="text-sm text-gray-400">No participants yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Name</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Email</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Project</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.relevantParticipants.map((p) => (
                    <tr key={p.id} className="border-b border-gray-100 last:border-b-0">
                      <td className="px-3 py-2 text-gray-900">{p.name}</td>
                      <td className="px-3 py-2 text-gray-600">{p.email}</td>
                      <td className="px-3 py-2 text-gray-600">{p.projectName}</td>
                      <td className="px-3 py-2 text-right">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[p.status] ?? ""}`}>
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
