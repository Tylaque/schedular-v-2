"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, BarChart3 } from "lucide-react";

type CapacityInfo = {
  dateKey: string;
  startTime: string;
  endTime: string;
  capacity: {
    totalSlots: number;
    bookableSlots: number;
    bookedSlots: number;
  };
  bookableTimes: string[];
};

type TeamAvailabilityEntry = {
  adminId: string;
  adminName: string;
  projectNames: string[];
  projectIds: string[];
  ranges: { dateKey: string; startTime: string; endTime: string }[];
  capacity?: CapacityInfo[];
};

function pad(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

function dateKey(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function defaultTo() {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return dateKey(d);
}

export default function TeamAvailabilityView() {
  const [fromDate, setFromDate] = useState(dateKey(new Date()));
  const [toDate, setToDate] = useState(defaultTo());
  const [adminId, setAdminId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [mode, setMode] = useState<"raw" | "remaining">("raw");
  const [data, setData] = useState<TeamAvailabilityEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    const params = new URLSearchParams({ from: fromDate, to: toDate });
    if (adminId) params.set("adminId", adminId);
    if (projectId) params.set("projectId", projectId);
    if (mode === "remaining") params.set("mode", "remaining");
    setLoading(true);
    try {
      const res = await fetch(`/api/team-availability?${params}`);
      if (res.ok) {
        setData(await res.json());
      } else {
        setData([]);
      }
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, adminId, projectId, mode]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const adminOptions = useMemo(() => {
    const seen = new Set<string>();
    const options: { id: string; name: string }[] = [];
    for (const entry of data) {
      if (seen.has(entry.adminId)) continue;
      seen.add(entry.adminId);
      options.push({ id: entry.adminId, name: entry.adminName });
    }
    return options;
  }, [data]);

  const projectOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const entry of data) {
      for (let i = 0; i < entry.projectIds.length; i++) {
        const id = entry.projectIds[i];
        const name = entry.projectNames[i] ?? id;
        if (!map.has(id)) map.set(id, name);
      }
    }
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => (a.name < b.name ? -1 : 1));
  }, [data]);

  const rangesByDate = (ranges: { dateKey: string; startTime: string; endTime: string }[]) => {
    const map = new Map<string, string[]>();
    for (const r of ranges) {
      const list = map.get(r.dateKey) ?? [];
      list.push(`${r.startTime}–${r.endTime}`);
      map.set(r.dateKey, list);
    }
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
  };

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1 dark:text-gray-400">From</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1 dark:text-gray-400">To</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1 dark:text-gray-400">Associate</label>
          <select
            value={adminId}
            onChange={(e) => setAdminId(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
          >
            <option value="">All associates</option>
            {adminOptions.map((a) => (<option key={a.id} value={a.id}>{a.name}</option>))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1 dark:text-gray-400">Project</label>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
          >
            <option value="">All projects</option>
            {projectOptions.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1 dark:text-gray-400">View</label>
          <button
            type="button"
            onClick={() => setMode(mode === "raw" ? "remaining" : "raw")}
            className={`text-sm font-medium rounded-lg px-3 py-1.5 border transition-colors ${
              mode === "remaining"
                ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-200 dark:border-brand-700"
                : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
            }`}
          >
            <BarChart3 className="w-4 h-4 inline-block mr-1 -mt-0.5" />
            {mode === "raw" ? "Remaining capacity" : "Declared ranges"}
          </button>
        </div>
      </div>

      {loading && (
        <p className="text-sm text-gray-400 flex items-center gap-2 py-8 dark:text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading availability...
        </p>
      )}

      {!loading && data.length === 0 && (
        <div className="text-center py-16">
          <p className="text-sm text-gray-400 dark:text-gray-500">No availability found for the selected filters.</p>
        </div>
      )}

      {!loading && data.length > 0 && mode === "raw" && (
        <div className="space-y-4">
          {data.map((entry) => (
            <div key={entry.adminId} className="rounded-xl border border-gray-200 bg-white shadow-sm p-4 dark:border-gray-700 dark:bg-gray-900">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-50">{entry.adminName}</h3>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {entry.projectNames.length > 0 ? entry.projectNames.join(", ") : "No assigned projects"}
                </span>
              </div>
              {entry.ranges.length === 0 ? (
                <p className="text-xs text-gray-400 dark:text-gray-500">No availability submitted in this date range.</p>
              ) : (
                <div className="space-y-1.5">
                  {rangesByDate(entry.ranges).map(([day, times]) => (
                    <div key={day} className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-medium text-gray-600 w-28 dark:text-gray-300">{day}</span>
                      <div className="flex flex-wrap gap-1.5">
                        {times.map((t, i) => (
                          <span
                            key={`${day}-${i}`}
                            className="inline-block rounded-full bg-brand-50 text-brand-700 px-2.5 py-0.5 text-xs font-medium dark:bg-brand-700/30 dark:text-brand-200"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!loading && data.length > 0 && mode === "remaining" && (
        <div className="space-y-4">
          {data.map((entry) => (
            <div key={entry.adminId} className="rounded-xl border border-gray-200 bg-white shadow-sm p-4 dark:border-gray-700 dark:bg-gray-900">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-50">{entry.adminName}</h3>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {entry.projectNames.length > 0 ? entry.projectNames.join(", ") : "No assigned projects"}
                </span>
              </div>

              {(!entry.capacity || entry.capacity.length === 0) ? (
                <p className="text-xs text-gray-400 dark:text-gray-500">No availability submitted in this date range.</p>
              ) : (
                <div className="space-y-2">
                  {entry.capacity.map((cap) => {
                    const pct = cap.capacity.totalSlots > 0
                      ? Math.round((cap.capacity.bookableSlots / cap.capacity.totalSlots) * 100)
                      : 0;
                    return (
                      <div key={`${cap.dateKey}-${cap.startTime}`} className="flex items-start gap-3">
                        <span className="text-xs font-medium text-gray-600 w-28 shrink-0 dark:text-gray-300">{cap.dateKey}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs text-gray-500 dark:text-gray-400">{cap.startTime}–{cap.endTime}</span>
                            <span className={`text-xs font-semibold ${pct === 0 ? "text-red-600 dark:text-red-400" : pct < 50 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                              {cap.capacity.bookableSlots}/{cap.capacity.totalSlots} bookable
                            </span>
                          </div>
                          {cap.capacity.bookableSlots > 0 && cap.capacity.bookableSlots < cap.capacity.totalSlots && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {cap.bookableTimes.map((t, i) => (
                                <span
                                  key={`${cap.dateKey}-${t}-${i}`}
                                  className="inline-block rounded-full bg-emerald-50 text-emerald-700 px-2 py-0.5 text-xs font-medium dark:bg-emerald-900/30 dark:text-emerald-300"
                                >
                                  {t}
                                </span>
                              ))}
                            </div>
                          )}
                          {cap.capacity.bookableSlots === cap.capacity.totalSlots && (
                            <span className="text-xs text-gray-400 dark:text-gray-500">All slots open</span>
                          )}
                          {cap.capacity.bookableSlots === 0 && (
                            <span className="text-xs text-red-500 dark:text-red-400">Fully booked</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
