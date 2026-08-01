"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";

const STATUS_BADGE: Record<string, string> = {
  waiting: "bg-gray-100 text-gray-700",
  offered: "bg-amber-100 text-amber-700",
  expired: "bg-red-100 text-red-700",
  claimed: "bg-green-100 text-green-700",
  cancelled: "bg-gray-200 text-gray-500",
};

const STATUS_LABEL: Record<string, string> = {
  waiting: "Waiting",
  offered: "Offered",
  expired: "Expired",
  claimed: "Claimed",
  cancelled: "Cancelled",
};

export type WaitlistEntryItem = {
  id: string;
  createdAt: Date;
  name: string;
  email: string;
  dateKey: string | null;
  time: string | null;
  status: string;
};

export default function WaitlistClient({ entries }: { entries: WaitlistEntryItem[] }) {
  const [search, setSearch] = useState("");

  const filteredEntries = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(
      (e) => e.name.toLowerCase().includes(q) || e.email.toLowerCase().includes(q),
    );
  }, [entries, search]);

  return (
    <div>
      {entries.length > 5 && (
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
      )}

      <div className="overflow-x-auto border border-gray-200 rounded-lg bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Joined</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Name</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Email</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Date / Time</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredEntries.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">
                  {entries.length === 0
                    ? "No waitlist entries for this project."
                    : "No waitlist entries match your search."}
                </td>
              </tr>
            )}
            {filteredEntries.map((entry) => (
              <tr key={entry.id} className="border-b border-gray-200 last:border-b-0">
                <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                  {new Date(entry.createdAt).toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" })}
                </td>
                <td className="px-4 py-3 text-gray-700">{entry.name}</td>
                <td className="px-4 py-3 text-gray-700">{entry.email}</td>
                <td className="px-4 py-3 text-gray-500">
                  {entry.dateKey ?? "—"}
                  {entry.time ? ` ${entry.time}` : ""}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[entry.status] ?? "bg-gray-100 text-gray-700"}`}>
                    {STATUS_LABEL[entry.status] ?? entry.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
