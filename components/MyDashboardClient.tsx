"use client";

import { useState, useEffect } from "react";
import {
  FolderKanban,
  CalendarClock,
  CheckCircle2,
  Users,
  Clock,
} from "lucide-react";

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

type DashboardData = {
  assignedProjects: { id: string; slug: string; name: string; status: string }[];
  submittedAvailabilityCount: number;
  upcomingSessions: { id: string; dateKey: string; time: string; status: string; projectName: string; participantName: string }[];
  completedSessions: { id: string; dateKey: string; time: string; status: string; projectName: string; participantName: string }[];
  relevantParticipants: { id: string; name: string; email: string; status: string; projectName: string }[];
};

export default function MyDashboardClient({ adminId }: { adminId: string }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    fetch(`/api/dashboard/admin?adminId=${encodeURIComponent(adminId)}`)
      .then((r) => {
        if (!r.ok) throw new Error("not found");
        return r.json();
      })
      .then((d: DashboardData) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [adminId]);

  return (
    <div>
      {loading && <p className="text-sm text-gray-500 py-8 text-center dark:text-gray-400">Loading...</p>}

      {error && (
        <div className="text-center py-8">
          <p className="text-sm text-red-600 dark:text-red-300">Admin not found.</p>
        </div>
      )}

      {data && (
        <div className="space-y-8">
          {/* Overview card */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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

          {/* Projects */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4 dark:border-gray-700 dark:bg-gray-900">
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

          {/* Upcoming sessions */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4 dark:border-gray-700 dark:bg-gray-900">
            <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2 dark:text-gray-50">
              <Clock className="w-4 h-4 text-gray-400 dark:text-gray-500" /> Upcoming Sessions ({data.upcomingSessions.length})
            </h2>
            {data.upcomingSessions.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500">No upcoming sessions.</p>
            ) : (
              <div className="space-y-2">
                {data.upcomingSessions.map((s) => (
                  <div key={s.id} className="flex items-center justify-between border border-gray-100 rounded-lg p-2.5 dark:border-gray-800">
                    <div>
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-50">{s.participantName}</span>
                      <span className="text-xs text-gray-400 ml-2 dark:text-gray-500">{s.projectName}</span>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{s.dateKey} @ {s.time}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Completed sessions */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4 dark:border-gray-700 dark:bg-gray-900">
            <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2 dark:text-gray-50">
              <CheckCircle2 className="w-4 h-4 text-gray-400 dark:text-gray-500" /> Completed Sessions ({data.completedSessions.length})
            </h2>
            {data.completedSessions.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500">No completed sessions.</p>
            ) : (
              <div className="space-y-2">
                {data.completedSessions.map((s) => (
                  <div key={s.id} className="flex items-center justify-between border border-gray-100 rounded-lg p-2.5 bg-gray-50 dark:border-gray-800 dark:bg-gray-950">
                    <div>
                      <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{s.participantName}</span>
                      <span className="text-xs text-gray-400 ml-2 dark:text-gray-500">{s.projectName}</span>
                    </div>
                    <div className="text-xs text-gray-400 dark:text-gray-500">{s.dateKey} @ {s.time}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Participants */}
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
                      <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide dark:text-gray-400">Name</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide dark:text-gray-400">Email</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide dark:text-gray-400">Project</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide dark:text-gray-400">Status</th>
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
      )}
    </div>
  );
}
