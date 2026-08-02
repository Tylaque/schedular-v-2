"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

type TeamAvailabilityEntry = {
  adminId: string;
  adminName: string;
  projectNames: string[];
  ranges: { dateKey: string; startTime: string; endTime: string }[];
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
  const [data, setData] = useState<TeamAvailabilityEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    const params = new URLSearchParams({ from: fromDate, to: toDate });
    if (adminId) params.set("adminId", adminId);
    if (projectId) params.set("projectId", projectId);
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
  }, [fromDate, toDate, adminId, projectId]);

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
    const set = new Set<string>();
    for (const entry of data) for (const p of entry.projectNames) set.add(p);
    return [...set].sort();
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
            {projectOptions.map((p) => (<option key={p} value={p}>{p}</option>))}
          </select>
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

      {!loading && data.length > 0 && (
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
    </div>
  );
}
