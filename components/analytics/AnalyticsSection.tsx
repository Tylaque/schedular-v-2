"use client";

import { useCallback, useEffect, useState } from "react";
import { BookingVolumeChart } from "./BookingVolumeChart";
import { AdminUtilizationChart } from "./AdminUtilizationChart";
import { ProjectHealthTable } from "./ProjectHealthTable";
import type {
  AdminUtilizationPoint,
  BookingVolumePoint,
  ProjectHealthItem,
  VolumeGranularity,
} from "@/lib/data/analytics";

type AnalyticsResponse = {
  projects: { id: string; name: string }[];
  volume: BookingVolumePoint[];
  utilization: AdminUtilizationPoint[];
  health: ProjectHealthItem[];
  meta: {
    fromDate: string;
    toDate: string;
    granularity: VolumeGranularity;
    projectId: string | null;
  };
};

function defaultTo(): string {
  return new Date().toISOString().slice(0, 10);
}

function defaultFrom(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 89);
  return d.toISOString().slice(0, 10);
}

const selectClass =
  "border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 bg-white dark:border-gray-600 dark:bg-gray-800 dark:text-gray-50";

export function AnalyticsSection() {
  const [fromDate, setFromDate] = useState(defaultFrom);
  const [toDate, setToDate] = useState(defaultTo);
  const [granularity, setGranularity] = useState<VolumeGranularity>("week");
  const [projectId, setProjectId] = useState("");
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ from: fromDate, to: toDate, granularity });
    if (projectId) params.set("projectId", projectId);
    try {
      const res = await fetch(`/api/analytics?${params.toString()}`);
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const json: AnalyticsResponse = await res.json();
      setData(json);
      setProjects(json.projects);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, granularity, projectId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          From
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className={selectClass}
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          To
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className={selectClass}
          />
        </label>
        <select
          value={granularity}
          onChange={(e) => setGranularity(e.target.value as VolumeGranularity)}
          className={selectClass}
        >
          <option value="week">Weekly</option>
          <option value="month">Monthly</option>
        </select>
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className={`${selectClass} min-w-[10rem]`}
        >
          <option value="">All projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {error && <div className="text-sm text-rose-600 dark:text-rose-400">{error}</div>}

      {loading ? (
        <div className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">
          Loading analytics…
        </div>
      ) : data ? (
        <>
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50">
              Booking volume
            </h2>
            <p className="mt-1 mb-4 text-sm text-gray-500 dark:text-gray-400">
              Bookings created per {granularity} in the selected range.
            </p>
            <BookingVolumeChart data={data.volume} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50">
                Admin utilization
              </h2>
              <p className="mt-1 mb-4 text-sm text-gray-500 dark:text-gray-400">
                Confirmed bookings as a share of submitted availability.
              </p>
              <AdminUtilizationChart data={data.utilization} />
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50">
                Project health
              </h2>
              <p className="mt-1 mb-4 text-sm text-gray-500 dark:text-gray-400">
                Fill and cancellation rates per project in the selected range.
              </p>
              <ProjectHealthTable data={data.health} />
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
