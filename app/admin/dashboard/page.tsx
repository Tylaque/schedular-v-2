import AdminNav from "@/components/AdminNav";
import { getSuperAdminStats, getAdminUtilization, getProjectProgress } from "@/lib/data/dashboard";
import {
  CheckCircle2,
  Clock,
  Users,
  CalendarX2,
  BarChart3,
  FolderKanban,
} from "lucide-react";

export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  active: "bg-emerald-100 text-emerald-700",
  paused: "bg-amber-100 text-amber-700",
  closed: "bg-red-100 text-red-700",
  archived: "bg-gray-100 text-gray-400",
};

function StatCard({
  icon,
  label,
  value,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string | number;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4">
      <div className="flex items-center gap-2 text-gray-400 mb-1">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      {value !== undefined && (
        <div className="text-2xl font-bold text-gray-900">{value}</div>
      )}
      {children}
    </div>
  );
}

export default async function AdminDashboardPage() {
  const stats = await getSuperAdminStats();
  const utilization = await getAdminUtilization();
  const progress = await getProjectProgress();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-6">
        <AdminNav current="/admin/dashboard" />
        <h1 className="text-xl font-bold text-gray-900 mb-6">Dashboard</h1>

        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard icon={<FolderKanban className="w-4 h-4" />} label="Total Projects" value={stats.totalProjects}>
            <div className="flex flex-wrap gap-1 mt-1">
              {Object.entries(stats.projectsByStatus).map(([status, count]) => (
                <span
                  key={status}
                  className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[status] ?? ""}`}
                >
                  {status} {count}
                </span>
              ))}
            </div>
          </StatCard>
          <StatCard icon={<Users className="w-4 h-4" />} label="Total Participants" value={stats.totalParticipants} />
          <StatCard icon={<CheckCircle2 className="w-4 h-4" />} label="Booked Sessions" value={stats.bookedSessions} />
          <StatCard icon={<Clock className="w-4 h-4" />} label="Upcoming" value={stats.upcomingSessions} />
          <StatCard
            icon={<CheckCircle2 className="w-4 h-4 text-emerald-600" />}
            label="Completed"
            value={stats.completedSessions}
          />
          <StatCard icon={<CalendarX2 className="w-4 h-4" />} label="Cancelled" value={stats.cancelledSessions} />
        </div>

        {/* Admin utilization */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4 mb-8">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Admin Utilization</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Admin</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Availability slots</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Confirmed bookings</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide w-1/3">Rate</th>
                </tr>
              </thead>
              <tbody>
                {utilization.map((u) => (
                  <tr key={u.adminId} className="border-b border-gray-100 last:border-b-0">
                    <td className="px-3 py-2.5 font-medium text-gray-900">{u.adminName}</td>
                    <td className="px-3 py-2.5 text-right text-gray-600">{u.submittedAvailabilityCount}</td>
                    <td className="px-3 py-2.5 text-right text-gray-600">{u.confirmedBookingsCount}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-brand-500 rounded-full transition-all"
                            style={{ width: `${Math.round(u.utilizationRate * 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500 w-10 text-right">
                          {Math.round(u.utilizationRate * 100)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Project progress */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Project Progress</h2>
          <div className="space-y-4">
            {progress.map((p) => (
              <div key={p.projectId} className="border border-gray-100 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 text-sm">{p.projectName}</span>
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[p.status] ?? ""}`}>
                      {p.status}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                      <span>Period elapsed</span>
                      <span>{p.periodElapsedPercent}%</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-brand-500 rounded-full"
                        style={{ width: `${p.periodElapsedPercent}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                      <span>Participants scheduled</span>
                      <span>{p.participantsScheduledPercent}%</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-brand-500 rounded-full"
                        style={{ width: `${p.participantsScheduledPercent}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
