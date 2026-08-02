"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock } from "lucide-react";
import { markBookingCompletedAction } from "@/lib/actions";

type SessionRow = {
  id: string;
  dateKey: string;
  time: string;
  status: string;
  displayStatus: string;
  projectName: string;
  participantName: string;
};

const STATUS_BADGE: Record<string, string> = {
  confirmed: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  awaiting_completion: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  rescheduled: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
};

const STATUS_LABELS: Record<string, string> = {
  confirmed: "Confirmed",
  awaiting_completion: "Awaiting completion",
  completed: "Completed",
  cancelled: "Cancelled",
  rescheduled: "Rescheduled",
};

type StatusFilter = "all" | "confirmed" | "awaiting_completion" | "completed" | "cancelled" | "rescheduled";

export default function MySessions({ sessions }: { sessions: SessionRow[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [completing, setCompleting] = useState<string | null>(null);
  const [error, setError] = useState("");

  const filtered = useMemo(
    () => (filter === "all" ? sessions : sessions.filter((s) => s.displayStatus === filter)),
    [sessions, filter]
  );

  async function handleComplete(id: string) {
    setCompleting(id);
    setError("");
    try {
      const res = await markBookingCompletedAction(id);
      if (!res.ok) {
        setError(
          res.reason === "not_assigned"
            ? "You are not assigned to this session."
            : "Could not complete this session."
        );
      } else {
        router.refresh();
      }
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setCompleting(null);
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4 mb-8 dark:border-gray-700 dark:bg-gray-900">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2 dark:text-gray-50">
          <Clock className="w-4 h-4 text-gray-400 dark:text-gray-500" /> My Sessions ({filtered.length})
        </h2>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as StatusFilter)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
          aria-label="Filter sessions by status"
        >
          <option value="all">All statuses</option>
          <option value="confirmed">Confirmed</option>
          <option value="awaiting_completion">Awaiting completion</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="rescheduled">Rescheduled</option>
        </select>
      </div>

      {error && (
        <p className="mb-3 text-xs text-red-600 dark:text-red-300">{error}</p>
      )}

      {filtered.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500">No sessions in this view.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 border border-gray-100 rounded-lg p-2.5 dark:border-gray-800">
              <div>
                <span className="text-sm font-medium text-gray-900 dark:text-gray-50">{s.participantName}</span>
                <span className="text-xs text-gray-400 ml-2 dark:text-gray-500">{s.projectName}</span>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[s.displayStatus] ?? ""}`}>
                  {STATUS_LABELS[s.displayStatus] ?? s.displayStatus}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">{s.dateKey} @ {s.time}</span>
                {s.displayStatus === "awaiting_completion" && (
                  <button
                    onClick={() => handleComplete(s.id)}
                    disabled={completing === s.id}
                    className="inline-flex items-center gap-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg px-3 py-1.5 transition-colors"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {completing === s.id ? "Marking..." : "Mark as completed"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
