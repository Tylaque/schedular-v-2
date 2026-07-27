"use client";

import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Plus, Trash2, Check, X } from "lucide-react";
import { saveAvailabilityRangesAction } from "@/lib/actions";

type Project = { id: string; name: string; durationMinutes: number };
type Range = { startTime: string; endTime: string };

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function isRangeEligibleForProject(range: Range, durationMinutes: number): boolean {
  const start = parseMinutes(range.startTime);
  const end = parseMinutes(range.endTime);
  return end - start >= durationMinutes;
}

function computeEligibleProjects(ranges: Range[], projects: Project[]): Project[] {
  return projects.filter((p) => ranges.some((r) => isRangeEligibleForProject(r, p.durationMinutes)));
}

const TIME_OPTIONS: string[] = [];
for (let h = 0; h < 24; h++) {
  for (let m = 0; m < 60; m += 15) {
    TIME_OPTIONS.push(`${h}:${m < 10 ? "0" : ""}${m}`);
  }
}

function formatTimeLabel(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${m < 10 ? "0" : ""}${m} ${ampm}`;
}

export default function AvailabilityRangePicker({ projects }: { projects: Project[] }) {
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    return fmtDate(now);
  });
  const [ranges, setRanges] = useState<Range[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch existing ranges when date changes
  useEffect(() => {
    setLoading(true);
    setMsg(null);
    fetch(`/api/availability-ranges?fromDate=${selectedDate}&toDate=${selectedDate}`)
      .then((res) => res.json())
      .then((data: { startTime: string; endTime: string }[]) => {
        setRanges(data.length > 0 ? data.map((r) => ({ startTime: r.startTime, endTime: r.endTime })) : []);
        setLoading(false);
      })
      .catch(() => {
        setRanges([]);
        setLoading(false);
      });
  }, [selectedDate]);

  function addRange() {
    setRanges([...ranges, { startTime: "09:00", endTime: "17:00" }]);
  }

  function removeRange(idx: number) {
    setRanges(ranges.filter((_, i) => i !== idx));
  }

  function updateRange(idx: number, field: "startTime" | "endTime", value: string) {
    const next = [...ranges];
    next[idx] = { ...next[idx], [field]: value };
    setRanges(next);
  }

  async function handleSave() {
    setSaving(true);
    setMsg(null);
    try {
      const result = await saveAvailabilityRangesAction(selectedDate, ranges);
      if (result.ok) {
        setMsg({ type: "ok", text: "Availability saved." });
      } else {
        setMsg({ type: "err", text: result.reason });
      }
    } catch {
      setMsg({ type: "err", text: "An error occurred." });
    } finally {
      setSaving(false);
    }
  }

  function shiftDate(offset: number) {
    const d = new Date(selectedDate + "T00:00:00");
    d.setDate(d.getDate() + offset);
    setSelectedDate(fmtDate(d));
  }

  const eligibleProjects = computeEligibleProjects(ranges, projects);
  const nonEligibleProjects = projects.filter((p) => !eligibleProjects.find((ep) => ep.id === p.id));

  const dayLabel = new Date(selectedDate + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-6">My Availability</h1>

      {/* Date navigation */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => shiftDate(-1)}
          className="p-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-600"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 text-center">
          <p className="text-sm font-semibold text-gray-900">{dayLabel}</p>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="text-xs text-gray-500 mt-1 border-0 bg-transparent text-center cursor-pointer"
          />
        </div>
        <button
          onClick={() => shiftDate(1)}
          className="p-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-600"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Success/Error message */}
      {msg && (
        <div
          className={`mb-4 p-3 rounded-lg text-sm ${
            msg.type === "ok"
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {msg.text}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-gray-400 py-8 text-center">Loading...</div>
      ) : (
        <>
          {/* Range editor */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5 mb-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">I&apos;m free during:</h2>

            {ranges.length === 0 ? (
              <p className="text-sm text-gray-400 mb-4">
                No availability set for this day. Click &quot;Add time range&quot; to declare when you&apos;re free.
              </p>
            ) : (
              <div className="space-y-3 mb-4">
                {ranges.map((r, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <select
                      value={r.startTime}
                      onChange={(e) => updateRange(i, "startTime", e.target.value)}
                      className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-700"
                    >
                      {TIME_OPTIONS.map((t) => (
                        <option key={`s-${t}`} value={t}>
                          {formatTimeLabel(t)}
                        </option>
                      ))}
                    </select>
                    <span className="text-sm text-gray-400">to</span>
                    <select
                      value={r.endTime}
                      onChange={(e) => updateRange(i, "endTime", e.target.value)}
                      className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-700"
                    >
                      {TIME_OPTIONS.map((t) => (
                        <option key={`e-${t}`} value={t}>
                          {formatTimeLabel(t)}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => removeRange(i)}
                      className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                onClick={addRange}
                className="text-sm font-medium text-brand-600 hover:text-brand-700 flex items-center gap-1"
              >
                <Plus className="w-4 h-4" /> Add time range
              </button>
            </div>
          </div>

          {/* Cross-project eligibility summary */}
          {projects.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5 mb-6">
              <h2 className="text-sm font-semibold text-gray-900 mb-3">Cross-project eligibility</h2>
              {ranges.length === 0 ? (
                <p className="text-sm text-gray-400">
                  Set your availability above to see which projects you could be booked for.
                </p>
              ) : (
                <>
                  {eligibleProjects.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs font-medium text-emerald-600 uppercase mb-2">Available for</p>
                      <div className="space-y-1">
                        {eligibleProjects.map((p) => (
                          <div key={p.id} className="flex items-center gap-2 text-sm">
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                            <span className="text-gray-700">{p.name}</span>
                            <span className="text-xs text-gray-400">({p.durationMinutes}-min sessions)</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {nonEligibleProjects.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-gray-400 uppercase mb-2">Not long enough for</p>
                      <div className="space-y-1">
                        {nonEligibleProjects.map((p) => (
                          <div key={p.id} className="flex items-center gap-2 text-sm">
                            <X className="w-3.5 h-3.5 text-gray-300" />
                            <span className="text-gray-400">{p.name}</span>
                            <span className="text-xs text-gray-300">({p.durationMinutes}-min sessions need a range of at least {p.durationMinutes} min)</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Save button */}
          <div className="sticky bottom-0 pb-6">
            <button
              disabled={saving}
              onClick={handleSave}
              className="w-full bg-brand-500 hover:bg-brand-600 disabled:bg-gray-300 text-white text-sm font-semibold rounded-lg py-2.5"
            >
              {saving ? "Saving..." : "Save availability"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
