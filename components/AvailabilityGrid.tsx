"use client";

import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { Check, X, Lock } from "lucide-react";
import { Project, generateSystemSlotGrid } from "@/lib/slotHelpers";
import { saveAvailabilityAction } from "@/lib/actions";

function isTodayBeforeLockDate(lockDate: Date): boolean {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const lock = new Date(lockDate);
  lock.setHours(0, 0, 0, 0);
  return now <= lock;
}

export default function AvailabilityGrid({ project }: { project: Project }) {
  const [selectedAdminId, setSelectedAdminId] = useState(project.admins[0]?.id ?? "");
  const [selections, setSelections] = useState<Set<string>>(new Set());
  const [isDragging, setIsDragging] = useState(false);
  const dragActionRef = useRef<"select" | "deselect" | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [hasUnsaved, setHasUnsaved] = useState(false);

  const locked = !isTodayBeforeLockDate(project.availabilityLockDate);

  const grid = useMemo(() => generateSystemSlotGrid(project, 14), [project]);

  // Fetch availability from DB when admin changes
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(
          `/api/availability?projectId=${project.id}&adminId=${selectedAdminId}`
        );
        if (!res.ok) return;
        const entries: { dateKey: string; time: string }[] = await res.json();
        setSelections(new Set(entries.map((e) => `${e.dateKey}|${e.time}`)));
        setHasUnsaved(false);
      } catch {
        // silently fail — grid stays empty
      }
    }
    load();
  }, [selectedAdminId, project.id]);

  const toggleCell = useCallback(
    (dateKey: string, time: string, force?: boolean) => {
      if (locked) return;
      const key = `${dateKey}|${time}`;
      setSelections((prev) => {
        const next = new Set(prev);
        const shouldAdd = force ?? !next.has(key);
        if (shouldAdd) next.add(key);
        else next.delete(key);
        return next;
      });
      setHasUnsaved(true);
    },
    [locked]
  );

  const handleCellMouseDown = useCallback(
    (dateKey: string, time: string, e: React.MouseEvent) => {
      if (locked) return;
      e.preventDefault();
      const key = `${dateKey}|${time}`;
      const currentlySelected = selections.has(key);
      dragActionRef.current = currentlySelected ? "deselect" : "select";
      setIsDragging(true);
      toggleCell(dateKey, time);
    },
    [locked, selections, toggleCell]
  );

  const handleCellMouseEnter = useCallback(
    (dateKey: string, time: string) => {
      if (!isDragging || locked) return;
      const key = `${dateKey}|${time}`;
      const shouldSelect = dragActionRef.current === "select";
      const currentlySelected = selections.has(key);
      if (shouldSelect !== currentlySelected) {
        toggleCell(dateKey, time, shouldSelect);
      }
    },
    [isDragging, locked, selections, toggleCell]
  );

  useEffect(() => {
    const handleMouseUp = () => {
      setIsDragging(false);
      dragActionRef.current = null;
    };
    window.addEventListener("mouseup", handleMouseUp);
    return () => window.removeEventListener("mouseup", handleMouseUp);
  }, []);

  async function handleSave() {
    const entries: { dateKey: string; time: string; selected: boolean }[] = [];

    // Build full list of all cells from grid
    for (const day of grid) {
      for (const time of day.times) {
        const key = `${day.dateKey}|${time}`;
        entries.push({ dateKey: day.dateKey, time, selected: selections.has(key) });
      }
    }

    await saveAvailabilityAction(project.id, selectedAdminId, entries);
    setHasUnsaved(false);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 4000);
  }

  const selectedCount = selections.size;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto p-6">
        {/* Page header */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">Submit your availability</h1>
          <p className="text-sm text-gray-500 mt-1">{project.name}</p>
        </div>

        {/* Locked banner */}
        {locked && (
          <div className="flex items-center gap-2 bg-gray-100 border border-gray-200 rounded-lg px-4 py-3 mb-4 text-sm text-gray-700">
            <Lock className="w-4 h-4 text-gray-400 shrink-0" />
            <span>
              Availability is locked for this project. Contact your Super Admin to make changes.
            </span>
          </div>
        )}

        {/* Success banner */}
        {showSuccess && (
          <div className="flex items-center gap-2 bg-emerald-100 border border-emerald-200 rounded-lg px-4 py-3 mb-4 text-sm text-emerald-700">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="flex-1">Availability saved successfully.</span>
            <button
              onClick={() => setShowSuccess(false)}
              className="text-emerald-600 hover:text-emerald-800"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Admin switcher */}
        <div className="flex items-center gap-3 mb-6">
          <label className="text-xs font-medium text-gray-500">Logged in as</label>
          <select
            value={selectedAdminId}
            onChange={(e) => setSelectedAdminId(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white text-gray-700"
          >
            {project.admins.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>

        {/* Grid wrapper - horizontal scroll on narrow viewports */}
        <div className="overflow-x-auto border border-gray-200 rounded-lg bg-white">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-white border-b border-r border-gray-200 px-2 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide min-w-[80px] text-left">
                  Time
                </th>
                {grid.map((day) => (
                  <th
                    key={day.dateKey}
                    className="border-b border-r border-gray-200 px-2 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide min-w-[90px]"
                  >
                    <div>{day.date.toLocaleDateString("en-US", { weekday: "short" })}</div>
                    <div className="text-gray-900 font-bold">
                      {day.date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grid[0]?.times.map((time) => (
                <tr key={time}>
                  <td className="sticky left-0 z-10 bg-white border-b border-r border-gray-200 px-2 py-1.5 text-xs text-gray-500 font-medium whitespace-nowrap">
                    {time}
                  </td>
                  {grid.map((day) => {
                    const key = `${day.dateKey}|${time}`;
                    const selected = selections.has(key);
                    return (
                      <td key={day.dateKey} className="border-b border-r border-gray-200 p-0">
                        <button
                          aria-pressed={selected}
                          disabled={locked}
                          onMouseDown={(e) => handleCellMouseDown(day.dateKey, time, e)}
                          onMouseEnter={() => handleCellMouseEnter(day.dateKey, time)}
                          className={
                            "w-full h-8 text-xs transition-colors select-none " +
                            (locked
                              ? "cursor-not-allowed bg-gray-50"
                              : selected
                              ? "bg-brand-500 text-white hover:bg-brand-600"
                              : "bg-white text-gray-400 hover:bg-brand-50")
                          }
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Summary strip */}
        <div className="mt-4 text-sm text-gray-700">
          {selectedCount} slot{selectedCount !== 1 ? "s" : ""} selected
          {hasUnsaved && <span className="text-gray-400 ml-1">(unsaved changes)</span>}
        </div>

        {/* Sticky save button */}
        <div className="sticky bottom-0 mt-4 pb-6">
          <button
            disabled={locked || !hasUnsaved}
            onClick={handleSave}
            className="w-full bg-brand-500 hover:bg-brand-600 disabled:bg-gray-300 text-white text-sm font-semibold rounded-lg py-2.5"
          >
            Save availability
          </button>
        </div>
      </div>
    </div>
  );
}
