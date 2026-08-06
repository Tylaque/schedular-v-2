"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Search, Loader2, CalendarX2 } from "lucide-react";
import { cancelBookingAction } from "@/lib/actions";
import { PlatformChip } from "@/components/shared/PlatformChip";
import type { PlatformKey } from "@/components/shared/PlatformChip";
import EmptyState from "@/components/shared/EmptyState";
import CalendarSkeleton from "@/components/CalendarSkeleton";
import {
  designTokens,
  dtScreenVars,
  statusChip,
  statusDot,
  cardTitleStyle,
} from "@/lib/design-tokens";

type CalendarEvent = {
  id: string;
  dateKey: string;
  time: string;
  status: string;
  displayStatus: string;
  meetingPlatform: PlatformKey | null;
  participantName: string;
  participantEmail: string;
  projectName: string;
  adminName: string;
};

type ViewMode = "day" | "week" | "month";

type StatusFilter = "all" | "confirmed" | "awaiting_completion" | "completed" | "cancelled" | "rescheduled";

// Booking display status -> design-token status key (same palette as
// My Dashboard: booked / link_sent / completed / cancelled / reminded).
const STATUS_TOKEN: Record<string, string> = {
  confirmed: "booked",
  awaiting_completion: "link_sent",
  completed: "completed",
  cancelled: "cancelled",
  rescheduled: "reminded",
};

const STATUS_LABELS: Record<string, string> = {
  confirmed: "Confirmed",
  awaiting_completion: "Awaiting completion",
  completed: "Completed",
  cancelled: "Cancelled",
  rescheduled: "Rescheduled",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS_SHORT = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function pad(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

function dateKey(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function getMonthDays(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startPad = first.getDay();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= last.getDate(); d++) cells.push(new Date(year, month, d));
  return cells;
}

function getWeekDays(ref: Date): Date[] {
  const start = new Date(ref);
  start.setDate(start.getDate() - start.getDay());
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    days.push(d);
  }
  return days;
}

function CancelBookingButton({ bookingId }: { bookingId: string }) {
  const [loading, setLoading] = useState(false);
  const handleCancel = useCallback(async () => {
    if (!confirm("Cancel this booking?")) return;
    setLoading(true);
    await cancelBookingAction(bookingId);
    setLoading(false);
  }, [bookingId]);
  return (
    <button
      onClick={handleCancel}
      disabled={loading}
      className="dt-chip"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        borderRadius: designTokens.radius.chip,
        padding: "4px 10px",
        fontSize: designTokens.type.caption.size,
        fontWeight: designTokens.type.caption.weight,
        lineHeight: 1,
        color: designTokens.color.status.no_show.dot,
        cursor: "pointer",
        whiteSpace: "nowrap",
        opacity: loading ? 0.6 : 1,
      }}
    >
      {loading ? <Loader2 style={{ width: 12, height: 12 }} className="animate-spin" /> : "Cancel"}
    </button>
  );
}

function EventChip({ ev }: { ev: CalendarEvent }) {
  const platformColor = ev.meetingPlatform
    ? designTokens.color.platform[ev.meetingPlatform]
    : designTokens.color.platform.off;
  return (
    <span
      className="dt-chip dt-text-secondary"
      title={`${ev.time} ${ev.projectName} - ${ev.participantName}`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        borderRadius: designTokens.radius.control,
        padding: "3px 8px",
        fontSize: designTokens.type.caption.size,
        lineHeight: 1.3,
        maxWidth: "100%",
        overflow: "hidden",
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: 999,
          backgroundColor: platformColor,
          flexShrink: 0,
        }}
      />
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {ev.time} {ev.projectName}
      </span>
    </span>
  );
}

function CalendarEmpty({ title, description }: { title: string; description: string }) {
  return <EmptyState icon={CalendarX2} title={title} description={description} />;
}

export default function CalendarView({
  projects,
  admins,
}: {
  projects: { id: string; name: string }[];
  admins: { id: string; name: string }[];
}) {
  const today = new Date();
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [cursorDate, setCursorDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [projectId, setProjectId] = useState("");
  const [adminId, setAdminId] = useState("");
  const [participantSearch, setParticipantSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchEvents = useCallback(async () => {
    let from: Date;
    let to: Date;
    if (viewMode === "month") {
      const y = cursorDate.getFullYear();
      const m = cursorDate.getMonth();
      from = new Date(y, m, 1);
      to = new Date(y, m + 1, 0);
    } else if (viewMode === "week") {
      const weekStart = new Date(cursorDate);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      from = weekStart;
      to = new Date(weekStart);
      to.setDate(to.getDate() + 6);
    } else {
      const d = selectedDate ?? cursorDate;
      from = d;
      to = d;
    }

    const params = new URLSearchParams({
      from: dateKey(from),
      to: dateKey(to),
    });
    if (projectId) params.set("projectId", projectId);
    if (adminId) params.set("adminId", adminId);
    if (participantSearch) params.set("participantSearch", participantSearch);

    setLoading(true);
    try {
      const res = await fetch(`/api/calendar?${params}`);
      if (res.ok) {
        const data = await res.json();
        setEvents(data);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [viewMode, cursorDate, selectedDate, projectId, adminId, participantSearch]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const filteredEvents = statusFilter === "all"
    ? events
    : events.filter((ev) => ev.displayStatus === statusFilter);

  const eventsByDateKey = new Map<string, CalendarEvent[]>();
  for (const ev of filteredEvents) {
    const list = eventsByDateKey.get(ev.dateKey) ?? [];
    list.push(ev);
    eventsByDateKey.set(ev.dateKey, list);
  }

  function navigate(dir: number) {
    if (viewMode === "month") {
      const d = new Date(cursorDate);
      d.setMonth(d.getMonth() + dir);
      setCursorDate(d);
    } else if (viewMode === "week") {
      const d = new Date(cursorDate);
      d.setDate(d.getDate() + 7 * dir);
      setCursorDate(d);
    } else {
      const d = selectedDate ?? cursorDate;
      const next = new Date(d);
      next.setDate(next.getDate() + dir);
      setSelectedDate(next);
      setCursorDate(next);
    }
  }

  const todayStr = dateKey(today);
  const controlStyle = {
    padding: "9px 12px",
    fontSize: designTokens.type.body.size,
    borderRadius: designTokens.radius.control,
    cursor: "pointer",
  } as const;
  const weekHeadStyle = {
    fontSize: designTokens.type.overline.size,
    fontWeight: designTokens.type.overline.weight,
    letterSpacing: designTokens.type.overline.letterSpacing,
    textAlign: "center",
    paddingBottom: designTokens.spacing.chipGap,
  } as const;

  // ---- Month view ----
  function renderMonth() {
    const y = cursorDate.getFullYear();
    const m = cursorDate.getMonth();
    const days = getMonthDays(y, m);

    return (
      <div>
        <div className="grid grid-cols-7 dt-text-muted" style={weekHeadStyle}>
          {DAYS_SHORT.map((d) => (<div key={d}>{d}</div>))}
        </div>
        <div
          className="grid grid-cols-7"
          style={{ gap: 4 }}
        >
          {days.map((d, i) => {
            if (!d) return <div key={i} />;
            const dk = dateKey(d);
            const dayEvents = eventsByDateKey.get(dk) ?? [];
            const isToday = dk === todayStr;
            const isSelected = selectedDate && dateKey(selectedDate) === dk;
            return (
              <button
                key={i}
                onClick={() => {
                  setSelectedDate(d);
                  setViewMode("day");
                }}
                className={isSelected ? "dt-brand" : isToday ? "dt-brand-tint" : "dt-cal-cell"}
                style={{
                  aspectRatio: "1",
                  borderRadius: designTokens.radius.control,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                  cursor: "pointer",
                  width: "100%",
                  transition: `background-color ${designTokens.motion.fast}, color ${designTokens.motion.fast}`,
                }}
              >
                <span
                  className={
                    isSelected || isToday
                      ? undefined
                      : dayEvents.length > 0
                      ? "dt-text-primary"
                      : "dt-text-muted"
                  }
                  style={{ fontSize: designTokens.type.body.size, fontWeight: isSelected || isToday ? 600 : dayEvents.length > 0 ? 600 : 400 }}
                >
                  {d.getDate()}
                </span>
                {dayEvents.length > 0 && (
                  <span className="dt-pill" style={{ fontSize: 10, lineHeight: 1, padding: "2px 6px", borderRadius: designTokens.radius.chip, minWidth: 16, textAlign: "center" }}>
                    {dayEvents.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ---- Week view ----
  function renderWeek() {
    const days = getWeekDays(cursorDate);
    return (
      <div>
        <div className="grid grid-cols-7 dt-text-muted" style={weekHeadStyle}>
          {DAYS_SHORT.map((d) => (<div key={d}>{d}</div>))}
        </div>
        <div className="grid grid-cols-7" style={{ gap: 4 }}>
          {days.map((d, i) => {
            const dk = dateKey(d);
            const dayEvents = eventsByDateKey.get(dk) ?? [];
            const isToday = dk === todayStr;
            const isSelected = selectedDate && dateKey(selectedDate) === dk;
            return (
              <div
                key={i}
                className={"dt-cal-cell " + (isSelected ? "dt-brand" : isToday ? "dt-brand-tint" : "")}
                style={{
                  borderRadius: designTokens.radius.control,
                  padding: 8,
                  display: "flex",
                  flexDirection: "column",
                  minHeight: 128,
                }}
              >
                <div
                  className={isSelected || isToday ? undefined : "dt-text-secondary"}
                  style={{
                    fontSize: designTokens.type.meta.size,
                    fontWeight: 600,
                    textAlign: "center",
                    marginBottom: 6,
                  }}
                >
                  {d.getDate()}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                  {dayEvents.slice(0, 4).map((ev) => (
                    <EventChip key={ev.id} ev={ev} />
                  ))}
                  {dayEvents.length > 4 && (
                    <div className="dt-text-muted" style={{ fontSize: designTokens.type.caption.size, textAlign: "center" }}>
                      +{dayEvents.length - 4} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ---- Day view ----
  function renderDay() {
    const d = selectedDate ?? cursorDate;
    const dk = dateKey(d);
    const dayEvents = eventsByDateKey.get(dk) ?? [];
    return (
      <div>
        <div className="dt-text-primary" style={{ ...cardTitleStyle, textAlign: "center", marginBottom: 16 }}>
          {d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
        </div>
        {dayEvents.length === 0 ? (
          <CalendarEmpty
            title="No bookings on this date"
            description="No bookings are scheduled for this day."
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: designTokens.spacing.cardGap }}>
            {dayEvents.map((ev) => (
              <div
                key={ev.id}
                className="dt-chip"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: designTokens.spacing.section,
                  padding: "12px 14px",
                  borderRadius: designTokens.radius.control,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span className="dt-text-primary" style={{ fontSize: designTokens.type.body.size, fontWeight: 600 }}>{ev.time}</span>
                    <span className="dt-text-secondary" style={{ fontSize: designTokens.type.body.size }}>{ev.projectName}</span>
                  </div>
                  <div className="dt-text-muted" style={{ fontSize: designTokens.type.caption.size, marginTop: 2 }}>
                    {ev.adminName} · {ev.participantName}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: designTokens.spacing.chipGap, flexShrink: 0 }}>
                  {ev.meetingPlatform && (
                    <PlatformChip
                      platform={ev.meetingPlatform}
                      label={ev.meetingPlatform === "zoom" ? "Zoom" : "Teams"}
                      connected
                      showStatus={false}
                    />
                  )}
                  <span style={statusChip(STATUS_TOKEN[ev.displayStatus] ?? "invited")}>
                    <span style={statusDot(STATUS_TOKEN[ev.displayStatus] ?? "invited")} />
                    {STATUS_LABELS[ev.displayStatus] ?? ev.displayStatus}
                  </span>
                  {ev.displayStatus === "confirmed" && (
                    <CancelBookingButton bookingId={ev.id} />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  const headerLabel = viewMode === "month"
    ? `${MONTHS[cursorDate.getMonth()]} ${cursorDate.getFullYear()}`
    : viewMode === "week"
    ? `Week of ${getWeekDays(cursorDate)[0].toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
    : (selectedDate ?? cursorDate).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });

  return (
    <div style={dtScreenVars()}>
      {/* View mode toggle + navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="dt-chip" style={{ display: "flex", alignItems: "center", gap: 4, padding: 4, borderRadius: designTokens.radius.control }}>
          {(["day", "week", "month"] as ViewMode[]).map((mode) => {
            const active = viewMode === mode;
            return (
              <button
                key={mode}
                onClick={() => {
                  setViewMode(mode);
                  if (mode === "day" && !selectedDate) setSelectedDate(today);
                }}
                className={active ? "dt-brand" : undefined}
                style={{
                  borderRadius: designTokens.radius.control,
                  padding: "6px 14px",
                  fontSize: designTokens.type.body.size,
                  fontWeight: designTokens.type.meta.weight,
                  lineHeight: 1,
                  border: "none",
                  cursor: "pointer",
                  color: active ? undefined : designTokens.color.text.secondary,
                  transition: `background-color ${designTokens.motion.fast}, color ${designTokens.motion.fast}`,
                }}
              >
                {mode === "day" ? "Day" : mode === "week" ? "Week" : "Month"}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(-1)}
            className="dt-chip"
            aria-label="Previous period"
            style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: 8, borderRadius: designTokens.radius.control, cursor: "pointer", border: "none" }}
          >
            <ChevronLeft style={{ width: 16, height: 16, color: designTokens.color.text.secondary }} />
          </button>
          <span className="dt-text-primary" style={{ ...cardTitleStyle, minWidth: 150, textAlign: "center" }}>{headerLabel}</span>
          <button
            onClick={() => navigate(1)}
            className="dt-chip"
            aria-label="Next period"
            style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: 8, borderRadius: designTokens.radius.control, cursor: "pointer", border: "none" }}
          >
            <ChevronRight style={{ width: 16, height: 16, color: designTokens.color.text.secondary }} />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          aria-label="Filter by project"
          className="dt-search dt-text-primary"
          style={controlStyle}
        >
          <option value="">All projects</option>
          {projects.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
        </select>
        <select
          value={adminId}
          onChange={(e) => setAdminId(e.target.value)}
          aria-label="Filter by admin"
          className="dt-search dt-text-primary"
          style={controlStyle}
        >
          <option value="">All admins</option>
          {admins.map((a) => (<option key={a.id} value={a.id}>{a.name}</option>))}
        </select>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: designTokens.color.text.muted }} />
          <input
            value={participantSearch}
            onChange={(e) => setParticipantSearch(e.target.value)}
            placeholder="Search participant..."
            className="dt-search dt-text-primary"
            style={{
              width: "100%",
              padding: "9px 12px 9px 34px",
              fontSize: designTokens.type.body.size,
              borderRadius: designTokens.radius.control,
            }}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          aria-label="Filter by status"
          className="dt-search dt-text-primary"
          style={controlStyle}
        >
          <option value="all">All statuses</option>
          <option value="confirmed">Confirmed</option>
          <option value="awaiting_completion">Awaiting completion</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="rescheduled">Rescheduled</option>
        </select>
      </div>

      {loading && <CalendarSkeleton />}

      {!loading && events.length === 0 && (
        <CalendarEmpty
          title="No bookings in this period"
          description="Nothing is booked in the range shown. Try another period or clear the filters."
        />
      )}

      {!loading && events.length > 0 && (
        <div>
          {viewMode === "month" && renderMonth()}
          {viewMode === "week" && renderWeek()}
          {viewMode === "day" && renderDay()}
          {filteredEvents.length === 0 && (
            <div className="dt-chip dt-text-secondary" style={{ marginTop: designTokens.spacing.section, padding: "10px 14px", borderRadius: designTokens.radius.control, fontSize: designTokens.type.body.size }}>
              No bookings match your filters.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
