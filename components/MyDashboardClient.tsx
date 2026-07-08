"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  User,
  FolderKanban,
  CalendarClock,
  CheckCircle2,
  Users,
  AlertCircle,
  Clock,
} from "lucide-react";

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

type AdminRecord = {
  id: string;
  name: string;
  initials: string;
  email: string;
};

type DashboardData = {
  assignedProjects: { id: string; slug: string; name: string; status: string }[];
  submittedAvailabilityCount: number;
  upcomingSessions: { id: string; dateKey: string; time: string; status: string; projectName: string; participantName: string }[];
  completedSessions: { id: string; dateKey: string; time: string; status: string; projectName: string; participantName: string }[];
  relevantParticipants: { id: string; name: string; email: string; status: string; projectName: string }[];
};

export default function MyDashboardClient({ admins }: { admins: AdminRecord[] }) {
  const router = useRouter();

  // TEMPORARY: replace with session.user.id once auth is wired up (see auth task).
  const [selectedAdminId, setSelectedAdminId] = useState(admins[0]?.id ?? "");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!selectedAdminId) return;
    setLoading(true);
    setError(false);
    fetch(`/api/dashboard/admin?adminId=${encodeURIComponent(selectedAdminId)}`)
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
  }, [selectedAdminId]);

  if (!admins.length) {
    return <p className="text-sm text-gray-500">No admins found in the system.</p>;
  }

  return (
    <div>
      {/* TEMPORARY: replace with session.user.id once auth is wired up (see auth task). */}
      <div className="flex items-center gap-3 mb-6 p-3 border border-amber-200 bg-amber-50 rounded-lg">
        <AlertCircle className="w-4 h-4 text-amber-500" />
        <span className="text-xs text-amber-700">
          Temporary admin selector — will be replaced with automatic session detection once auth is wired up.
        </span>
        <select
          value={selectedAdminId}
          onChange={(e) => setSelectedAdminId(e.target.value)}
          className="ml-auto text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white text-gray-700"
        >
          {admins.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({a.email})
            </option>
          ))}
        </select>
      </div>

      {loading && <p className="text-sm text-gray-500 py-8 text-center">Loading...</p>}

      {error && (
        <div className="text-center py-8">
          <p className="text-sm text-red-600">Admin not found.</p>
        </div>
      )}

      {data && (
        <div className="space-y-8">
          {/* Overview card */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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

          {/* Projects */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4">
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

          {/* Upcoming sessions */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4">
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

          {/* Completed sessions */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4">
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

          {/* Participants */}
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
                      <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Project</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
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
      )}
    </div>
  );
}
