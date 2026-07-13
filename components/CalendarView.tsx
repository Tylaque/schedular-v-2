"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Search, Loader2 } from "lucide-react";
import { cancelBookingAction } from "@/lib/actions";

type CalendarEvent = {
  id: string;
  dateKey: string;
  time: string;
  status: string;
  participantName: string;
  participantEmail: string;
  projectName: string;
  adminName: string;
};

type ViewMode = "day" | "week" | "month";

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
      className="text-xs text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
    >
      {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Cancel"}
    </button>
  );
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

  const eventsByDateKey = new Map<string, CalendarEvent[]>();
  for (const ev of events) {
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

  // ---- Month view ----
  function renderMonth() {
    const y = cursorDate.getFullYear();
    const m = cursorDate.getMonth();
    const days = getMonthDays(y, m);

    return (
      <div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-400 mb-1">
          {DAYS_SHORT.map((d) => (<div key={d}>{d}</div>))}
        </div>
        <div className="grid grid-cols-7 gap-1">
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
                className={
                  "aspect-square rounded-lg text-sm flex flex-col items-center justify-center transition-colors relative " +
                  (isSelected
                    ? "bg-brand-500 text-white font-semibold"
                    : isToday
                    ? "bg-brand-50 text-brand-700 font-semibold"
                    : dayEvents.length > 0
                    ? "text-gray-700 hover:bg-brand-50 font-medium"
                    : "text-gray-300")
                }
              >
                <span>{d.getDate()}</span>
                {dayEvents.length > 0 && (
                  <span className="text-[10px] leading-none mt-0.5 opacity-70">
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
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-400 mb-1">
          {DAYS_SHORT.map((d) => (<div key={d}>{d}</div>))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((d, i) => {
            const dk = dateKey(d);
            const dayEvents = eventsByDateKey.get(dk) ?? [];
            const isToday = dk === todayStr;
            const isSelected = selectedDate && dateKey(selectedDate) === dk;
            return (
              <div
                key={i}
                className={
                  "rounded-lg text-sm p-1 min-h-[120px] " +
                  (isSelected
                    ? "bg-brand-50 border border-brand-200"
                    : isToday
                    ? "bg-brand-50/50"
                    : "bg-white")
                }
              >
                <div className={
                  "text-xs font-medium text-center mb-1 " +
                  (isToday ? "text-brand-700" : "text-gray-500")
                }>
                  {d.getDate()}
                </div>
                <div className="space-y-0.5">
                  {dayEvents.slice(0, 4).map((ev) => (
                    <div
                      key={ev.id}
                      className="text-[10px] bg-brand-100 text-brand-700 rounded px-1 py-0.5 truncate leading-tight"
                      title={`${ev.time} ${ev.projectName} - ${ev.participantName}`}
                    >
                      {ev.time} {ev.projectName}
                    </div>
                  ))}
                  {dayEvents.length > 4 && (
                    <div className="text-[10px] text-gray-400 text-center">+{dayEvents.length - 4} more</div>
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
        <div className="text-lg font-semibold text-gray-900 mb-4 text-center">
          {d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
        </div>
        {dayEvents.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No events on this date.</p>
        ) : (
          <div className="space-y-2">
                {dayEvents.map((ev) => (
              <div key={ev.id} className="border border-gray-200 rounded-lg p-3 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900">{ev.time}</span>
                    <span className="text-sm text-gray-500">{ev.projectName}</span>
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {ev.adminName} · {ev.participantName}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block rounded-full px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-700">
                    {ev.status}
                  </span>
                  {ev.status === "confirmed" && (
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
    <div>
      {/* View mode toggle */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {(["day", "week", "month"] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => {
                setViewMode(mode);
                if (mode === "day" && !selectedDate) setSelectedDate(today);
              }}
              className={
                "text-sm rounded-lg px-3 py-1.5 font-medium " +
                (viewMode === mode
                  ? "bg-brand-500 text-white"
                  : "border border-gray-300 text-gray-700 hover:bg-gray-50")
              }
            >
              {mode === "day" ? "Day" : mode === "week" ? "Week" : "Month"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="p-1 rounded hover:bg-gray-100 text-gray-500">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold text-gray-900 min-w-[140px] text-center">{headerLabel}</span>
          <button onClick={() => navigate(1)} className="p-1 rounded hover:bg-gray-100 text-gray-500">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white text-gray-700"
        >
          <option value="">All projects</option>
          {projects.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
        </select>
        <select
          value={adminId}
          onChange={(e) => setAdminId(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white text-gray-700"
        >
          <option value="">All admins</option>
          {admins.map((a) => (<option key={a.id} value={a.id}>{a.name}</option>))}
        </select>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            value={participantSearch}
            onChange={(e) => setParticipantSearch(e.target.value)}
            placeholder="Search participant..."
            className="w-full text-sm border border-gray-300 rounded-lg pl-8 pr-3 py-1.5"
          />
        </div>
      </div>

      {loading && <p className="text-sm text-gray-400 text-center py-8">Loading...</p>}

      {!loading && events.length === 0 && (
        <div className="text-center py-16">
          <p className="text-sm text-gray-400">No matching events found.</p>
        </div>
      )}

      {!loading && events.length > 0 && (
        <div>
          {viewMode === "month" && renderMonth()}
          {viewMode === "week" && renderWeek()}
          {viewMode === "day" && renderDay()}
        </div>
      )}
    </div>
  );
}
