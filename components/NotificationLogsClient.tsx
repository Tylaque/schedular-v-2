"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Search, CheckCircle2, XCircle, Send } from "lucide-react";
import { ALL_CATEGORIES } from "@/lib/template-utils";

const STATUS_STYLE: Record<string, string> = {
  sent: "bg-emerald-100 text-emerald-700",
  failed: "bg-red-100 text-red-700",
  test: "bg-gray-100 text-gray-500",
};

const STATUS_ICON: Record<string, ReactNode> = {
  sent: <CheckCircle2 className="w-4 h-4 text-emerald-600" />,
  failed: <XCircle className="w-4 h-4 text-red-500" />,
  test: <Send className="w-4 h-4 text-gray-400" />,
};

const CATEGORY_LABEL = new Map(ALL_CATEGORIES.map((c) => [c.value, c.label]));

export type NotificationLogItem = {
  id: string;
  createdAt: Date;
  category: string;
  recipientEmail: string;
  subject: string;
  status: string;
};

export default function NotificationLogsClient({ logs }: { logs: NotificationLogItem[] }) {
  const [search, setSearch] = useState("");

  const filteredLogs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter(
      (l) =>
        l.recipientEmail.toLowerCase().includes(q) ||
        l.subject.toLowerCase().includes(q),
    );
  }, [logs, search]);

  return (
    <div>
      {logs.length > 5 && (
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by recipient or subject..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
      )}

      <div className="overflow-x-auto border border-gray-200 rounded-lg bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Timestamp</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Category</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Recipient</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Subject</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">
                  No notifications match your search.
                </td>
              </tr>
            )}
            {filteredLogs.map((log) => (
              <tr key={log.id} className="border-b border-gray-200 last:border-b-0">
                <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                  {log.createdAt.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-gray-900">
                  {CATEGORY_LABEL.get(log.category) ?? log.category}
                </td>
                <td className="px-4 py-3 text-gray-700">{log.recipientEmail}</td>
                <td className="px-4 py-3 text-gray-700 max-w-xs truncate">{log.subject}</td>
                <td className="px-4 py-3 text-right">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[log.status] ?? ""}`}>
                    {STATUS_ICON[log.status] ?? null}
                    {log.status}
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
