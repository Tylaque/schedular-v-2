import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getAdminDashboardData, countTodaySessions } from "@/lib/data/dashboard";
import { getAdminCertifications } from "@/lib/data/certifications";
import GreetingHeader from "@/components/GreetingHeader";
import MySessions from "@/components/MySessions";
import { FolderKanban, CalendarClock, Clock, CheckCircle2, Users, BadgeCheck } from "lucide-react";

export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<string, string> = {
  invited: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
  link_sent: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  booked: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  reminded: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  no_show: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  cancelled: "bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-300",
};

const STATUS_BADGE_PROJECT: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  paused: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  closed: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  archived: "bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500",
};

export default async function MyAreaPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/signin");
  }

  const data = await getAdminDashboardData(session.user.id);
  const todayCount = await countTodaySessions({ adminId: session.user.id });
  const certifications = await getAdminCertifications(session.user.id);
  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-sm text-gray-500 dark:text-gray-400">Your account is not fully set up yet. Please contact an administrator.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        <GreetingHeader name={session.user.name ?? ""} todayCount={todayCount} />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4 dark:border-gray-700 dark:bg-gray-900">
            <div className="flex items-center gap-2 text-gray-400 mb-1 dark:text-gray-500">
              <FolderKanban className="w-4 h-4" />
              <span className="text-xs font-medium">Assigned Projects</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-50">{data.assignedProjects.length}</div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4 dark:border-gray-700 dark:bg-gray-900">
            <div className="flex items-center gap-2 text-gray-400 mb-1 dark:text-gray-500">
              <CalendarClock className="w-4 h-4" />
              <span className="text-xs font-medium">Availability Entries</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-50">{data.submittedAvailabilityCount}</div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4 dark:border-gray-700 dark:bg-gray-900">
            <div className="flex items-center gap-2 text-gray-400 mb-1 dark:text-gray-500">
              <Clock className="w-4 h-4" />
              <span className="text-xs font-medium">Upcoming Sessions</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-50">{data.upcomingSessions.length}</div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4 dark:border-gray-700 dark:bg-gray-900">
            <div className="flex items-center gap-2 text-gray-400 mb-1 dark:text-gray-500">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-300" />
              <span className="text-xs font-medium">Completed Sessions</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-50">{data.completedSessions.length}</div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4 mb-8 dark:border-gray-700 dark:bg-gray-900">
          <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2 dark:text-gray-50">
            <FolderKanban className="w-4 h-4 text-gray-400 dark:text-gray-500" /> Assigned Projects
          </h2>
          {data.assignedProjects.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500">No projects assigned.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {data.assignedProjects.map((p) => (
                <div key={p.id} className="border border-gray-200 rounded-lg p-3 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900 text-sm dark:text-gray-50">{p.name}</span>
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_PROJECT[p.status] ?? ""}`}>
                      {p.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <MySessions sessions={data.sessions} />

        <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4 mb-8 dark:border-gray-700 dark:bg-gray-900">
          <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2 dark:text-gray-50">
            <BadgeCheck className="w-4 h-4 text-gray-400 dark:text-gray-500" /> My Certifications
          </h2>
          {certifications.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500">No certifications assigned yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {certifications.map((c) => (
                <div
                  key={c.id}
                  className="inline-flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 dark:border-gray-700"
                >
                  <BadgeCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-300" />
                  <div>
                    <span className="block text-sm font-medium text-gray-900 dark:text-gray-50">
                      {c.certification.name}
                    </span>
                    <span className="block text-xs text-gray-400 dark:text-gray-500">
                      {c.grantedBy ? `Granted by ${c.grantedBy.name}` : "Granted"}
                      {c.certification.description ? ` — ${c.certification.description}` : ""}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4 dark:border-gray-700 dark:bg-gray-900">
          <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2 dark:text-gray-50">
            <Users className="w-4 h-4 text-gray-400 dark:text-gray-500" /> Participants ({data.relevantParticipants.length})
          </h2>
          {data.relevantParticipants.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500">No participants yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase dark:text-gray-400">Name</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase dark:text-gray-400">Email</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase dark:text-gray-400">Project</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase dark:text-gray-400">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.relevantParticipants.map((p) => (
                    <tr key={p.id} className="border-b border-gray-100 last:border-b-0 dark:border-gray-800">
                      <td className="px-3 py-2 text-gray-900 dark:text-gray-50">{p.name}</td>
                      <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{p.email}</td>
                      <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{p.projectName}</td>
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
  );
}
