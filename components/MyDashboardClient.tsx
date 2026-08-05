"use client";

import { useState, useEffect } from "react";
import {
  FolderKanban,
  CalendarClock,
  CheckCircle2,
  Clock,
  Users,
  CalendarDays,
  UserX,
} from "lucide-react";
import {
  designTokens,
  dtScreenVars,
  pageTitleStyle,
  pageSubtitleStyle,
  cardTitleStyle,
  bodyTextStyle,
  metaTextStyle,
  statusChip,
  statusDot,
} from "@/lib/design-tokens";
import { PlatformChip } from "@/components/shared/PlatformChip";
import type { PlatformKey } from "@/components/shared/PlatformChip";
import StatCard from "@/components/shared/StatCard";
import DashboardSkeleton from "@/components/DashboardSkeleton";

type Session = {
  id: string;
  dateKey: string;
  time: string;
  status: string;
  projectName: string;
  participantName: string;
  meetingPlatform: PlatformKey | null;
};

type DashboardData = {
  assignedProjects: { id: string; slug: string; name: string; status: string }[];
  submittedAvailabilityCount: number;
  upcomingSessions: Session[];
  completedSessions: Session[];
  relevantParticipants: { id: string; name: string; email: string; status: string; projectName: string }[];
};

function formatSessionLabel(dateKey: string, time: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const dayLabel = date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  const [hh, mm] = time.split(":").map(Number);
  const period = hh >= 12 ? "PM" : "AM";
  const hour = ((hh + 11) % 12) + 1;
  return `${dayLabel} · ${hour}:${String(mm).padStart(2, "0")} ${period}`;
}

function addDaysKey(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span style={statusChip(status)}>
      <span style={statusDot(status)} />
      {status.replace("_", " ")}
    </span>
  );
}

function SectionHeader({ icon, title, count }: { icon: React.ReactNode; title: string; count?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: designTokens.spacing.chipGap }}>
      <span className="dt-text-muted" style={{ display: "inline-flex" }}>{icon}</span>
      <h2 className="dt-text-primary" style={{ ...cardTitleStyle, color: undefined }}>
        {title}
      </h2>
      {typeof count === "number" && count > 0 && (
        <span
          className="dt-text-muted"
          style={{
            fontSize: designTokens.type.caption.size,
            fontWeight: designTokens.type.caption.weight,
          }}
        >
          {count}
        </span>
      )}
    </div>
  );
}

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
}) {
  return (
    <div className="text-center py-10">
      <div className="dt-text-muted" style={{ display: "flex", justifyContent: "center", marginBottom: designTokens.spacing.section }}>
        {icon}
      </div>
      <p className="dt-text-secondary" style={{ ...bodyTextStyle, fontWeight: 600, color: undefined }}>
        {title}
      </p>
      {description && (
        <p className="dt-text-muted" style={{ ...metaTextStyle, color: undefined, marginTop: 4 }}>
          {description}
        </p>
      )}
    </div>
  );
}

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

  if (loading) return <DashboardSkeleton />;

  if (error || !data) {
    return (
      <div className="max-w-5xl mx-auto p-6" style={dtScreenVars()}>
        <EmptyState
          icon={<UserX style={{ width: 28, height: 28 }} />}
          title="Dashboard unavailable"
          description="We couldn't load your dashboard. Please try again."
        />
      </div>
    );
  }

  const activeProjects = data.assignedProjects.filter((p) => p.status === "active").length;

  const todayKey = new Date().toISOString().slice(0, 10);
  const weekEndKey = addDaysKey(todayKey, 7);
  const upcomingThisWeek = data.upcomingSessions.filter(
    (s) => s.dateKey >= todayKey && s.dateKey <= weekEndKey,
  ).length;

  return (
    <div className="max-w-5xl mx-auto p-6" style={dtScreenVars()}>
      <div className="mb-6">
        <h1 className="dt-text-primary" style={{ ...pageTitleStyle, color: undefined }}>
          My Dashboard
        </h1>
        <p className="mt-1 dt-text-secondary" style={{ ...pageSubtitleStyle, color: undefined }}>
          Your projects, availability, and upcoming sessions.
        </p>
      </div>

      {/* Stat cards row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: designTokens.spacing.cardGap,
        }}
      >
        <StatCard
          icon={<FolderKanban style={{ width: 14, height: 14 }} />}
          label="Active Projects"
          value={activeProjects}
          sub={data.assignedProjects.length === 1 ? "1 project assigned" : `${data.assignedProjects.length} projects assigned`}
        />
        <StatCard
          icon={<CalendarClock style={{ width: 14, height: 14 }} />}
          label="Upcoming Sessions"
          value={data.upcomingSessions.length}
          sub={upcomingThisWeek === 1 ? "1 in the next 7 days" : `${upcomingThisWeek} in the next 7 days`}
        />
        <StatCard
          icon={<Clock style={{ width: 14, height: 14 }} />}
          label="Availability Entries"
          value={data.submittedAvailabilityCount}
          sub="submitted slots"
        />
        <StatCard
          icon={<CheckCircle2 style={{ width: 14, height: 14 }} />}
          label="Completed Sessions"
          value={data.completedSessions.length}
          sub="all time"
        />
      </div>

      {/* Upcoming sessions — real bookings with platform chips */}
      <div className="project-card" style={{ marginTop: designTokens.spacing.section + 8 }}>
        <SectionHeader
          icon={<CalendarDays style={{ width: 16, height: 16 }} />}
          title="Upcoming Sessions"
          count={data.upcomingSessions.length}
        />
        {data.upcomingSessions.length === 0 ? (
          <EmptyState
            icon={<CalendarDays style={{ width: 28, height: 28 }} />}
            title="No upcoming sessions"
            description="When sessions are booked with you, they'll show up here."
          />
        ) : (
          <div style={{ marginTop: designTokens.spacing.section }}>
            {data.upcomingSessions.map((s, i) => (
              <div
                key={s.id}
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: designTokens.spacing.chipGap,
                  padding: `${designTokens.spacing.control}px 0`,
                  borderBottom:
                    i < data.upcomingSessions.length - 1
                      ? `1px solid ${designTokens.color.border.subtle}`
                      : "none",
                }}
              >
                <div className="min-w-0">
                  <div className="dt-text-primary" style={{ ...bodyTextStyle, fontWeight: 600, color: undefined }}>
                    {s.participantName}
                  </div>
                  <div className="dt-text-secondary" style={{ ...metaTextStyle, color: undefined }}>
                    {formatSessionLabel(s.dateKey, s.time)} · {s.projectName}
                  </div>
                </div>
                {s.meetingPlatform && (
                  <PlatformChip
                    platform={s.meetingPlatform}
                    label={s.meetingPlatform === "zoom" ? "Zoom" : "Teams"}
                    connected
                    showStatus={false}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Assigned projects */}
      <div className="project-card" style={{ marginTop: designTokens.spacing.section + 8 }}>
        <SectionHeader
          icon={<FolderKanban style={{ width: 16, height: 16 }} />}
          title="Assigned Projects"
          count={data.assignedProjects.length}
        />
        {data.assignedProjects.length === 0 ? (
          <EmptyState
            icon={<FolderKanban style={{ width: 28, height: 28 }} />}
            title="No projects assigned"
            description="You'll see projects here once an owner assigns them to you."
          />
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: designTokens.spacing.cardGap,
              marginTop: designTokens.spacing.section,
            }}
          >
            {data.assignedProjects.map((p) => (
              <div key={p.id} className="project-card">
                <div className="dt-text-primary" style={{ ...cardTitleStyle, color: undefined }}>
                  {p.name}
                </div>
                <div style={{ marginTop: designTokens.spacing.chipGap }}>
                  <StatusBadge status={p.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Completed sessions */}
      <div className="project-card" style={{ marginTop: designTokens.spacing.section + 8 }}>
        <SectionHeader
          icon={<CheckCircle2 style={{ width: 16, height: 16 }} />}
          title="Completed Sessions"
          count={data.completedSessions.length}
        />
        {data.completedSessions.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 style={{ width: 28, height: 28 }} />}
            title="No completed sessions yet"
            description="Completed bookings will appear here."
          />
        ) : (
          <div style={{ marginTop: designTokens.spacing.section }}>
            {data.completedSessions.map((s, i) => (
              <div
                key={s.id}
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: designTokens.spacing.chipGap,
                  padding: `${designTokens.spacing.control}px 0`,
                  borderBottom:
                    i < data.completedSessions.length - 1
                      ? `1px solid ${designTokens.color.border.subtle}`
                      : "none",
                }}
              >
                <div className="min-w-0">
                  <div className="dt-text-secondary" style={{ ...bodyTextStyle, color: undefined }}>
                    {s.participantName}
                  </div>
                  <div className="dt-text-muted" style={{ ...metaTextStyle, color: undefined }}>
                    {formatSessionLabel(s.dateKey, s.time)} · {s.projectName}
                  </div>
                </div>
                {s.meetingPlatform && (
                  <PlatformChip
                    platform={s.meetingPlatform}
                    label={s.meetingPlatform === "zoom" ? "Zoom" : "Teams"}
                    connected
                    showStatus={false}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Participants */}
      <div className="project-card" style={{ marginTop: designTokens.spacing.section + 8 }}>
        <SectionHeader
          icon={<Users style={{ width: 16, height: 16 }} />}
          title="Participants"
          count={data.relevantParticipants.length}
        />
        {data.relevantParticipants.length === 0 ? (
          <EmptyState
            icon={<Users style={{ width: 28, height: 28 }} />}
            title="No participants yet"
            description="Participants added to your projects will appear here."
          />
        ) : (
          <div style={{ marginTop: designTokens.spacing.section, overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Name", "Email", "Project", "Status"].map((h) => (
                    <th
                      key={h}
                      className="dt-text-muted"
                      style={{
                        textAlign: h === "Status" ? "right" : "left",
                        fontSize: designTokens.type.overline.size,
                        fontWeight: designTokens.type.overline.weight,
                        letterSpacing: designTokens.type.overline.letterSpacing,
                        textTransform: "uppercase",
                        padding: "6px 0",
                        borderBottom: `1px solid ${designTokens.color.border.subtle}`,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.relevantParticipants.map((p) => (
                  <tr key={p.id} style={{ borderBottom: `1px solid ${designTokens.color.border.subtle}` }}>
                    <td className="dt-text-primary" style={{ ...bodyTextStyle, color: undefined, padding: "8px 0", whiteSpace: "nowrap" }}>
                      {p.name}
                    </td>
                    <td className="dt-text-secondary" style={{ ...bodyTextStyle, color: undefined, padding: "8px 0", whiteSpace: "nowrap" }}>
                      {p.email}
                    </td>
                    <td className="dt-text-secondary" style={{ ...bodyTextStyle, color: undefined, padding: "8px 0" }}>
                      {p.projectName}
                    </td>
                    <td style={{ padding: "8px 0", textAlign: "right", whiteSpace: "nowrap" }}>
                      <StatusBadge status={p.status} />
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
