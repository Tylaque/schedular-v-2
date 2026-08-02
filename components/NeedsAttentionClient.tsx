"use client";

import { useState } from "react";
import { AlertTriangle, Loader2, Check } from "lucide-react";
import { manuallyResolveFlaggedBookingAction } from "@/lib/actions";

type FlaggedBooking = {
  id: string;
  dateKey: string;
  time: string;
  participantName: string;
  participantEmail: string;
  manualAttentionReason: string | null;
  adminName: string;
  adminEmail: string;
  projectName: string;
  projectSlug: string;
  eligibleAdmins: { id: string; name: string }[];
};

export default function NeedsAttentionClient({
  flagged,
}: {
  flagged: FlaggedBooking[];
}) {
  const [resolved, setResolved] = useState<Set<string>>(new Set());
  const [resolving, setResolving] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [selectedAdmin, setSelectedAdmin] = useState<Record<string, string>>({});

  async function handleResolve(bookingId: string) {
    const newAdminId = selectedAdmin[bookingId];
    if (!newAdminId) return;
    setResolving(bookingId);
    setMsg(null);
    try {
      const result = await manuallyResolveFlaggedBookingAction(bookingId, newAdminId);
      if (result.ok) {
        setResolved((prev) => new Set(prev).add(bookingId));
        setMsg({ type: "ok", text: "Booking reassigned successfully." });
      } else {
        setMsg({ type: "err", text: result.reason });
      }
    } catch {
      setMsg({ type: "err", text: "Failed to reassign booking." });
    } finally {
      setResolving(null);
    }
  }

  return (
    <div>
      {msg && (
        <div
          className={`mb-4 rounded-lg p-3 text-sm ${
            msg.type === "ok"
              ? "bg-green-50 border border-green-200 text-green-700 dark:bg-green-900/40 dark:border-green-800 dark:text-green-300"
              : "bg-red-50 border border-red-200 text-red-700 dark:bg-red-900/40 dark:border-red-800 dark:text-red-300"
          }`}
        >
          {msg.text}
        </div>
      )}

      <div className="space-y-4">
        {flagged.map((b) => {
          const isResolved = resolved.has(b.id);
          return (
            <div
              key={b.id}
              className={`bg-white border rounded-lg p-4 shadow-sm dark:bg-gray-900 ${
                isResolved ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/40" : "border-amber-200 dark:border-amber-800"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-gray-900 text-sm dark:text-gray-50">{b.projectName}</span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">/</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {b.dateKey} at {b.time}
                    </span>
                    {isResolved && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-300">
                        <Check className="w-3 h-3" /> Resolved
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mb-1 dark:text-gray-400">
                    Participant: <strong>{b.participantName}</strong> ({b.participantEmail})
                  </p>
                  <p className="text-sm text-gray-500 mb-2 dark:text-gray-400">
                    Was assigned to: {b.adminName} ({b.adminEmail})
                  </p>
                  <div className="bg-amber-50 border border-amber-100 rounded p-2 text-xs text-amber-700 mb-3 dark:bg-amber-900/40 dark:border-amber-800 dark:text-amber-300">
                    <AlertTriangle className="w-3 h-3 inline mr-1" />
                    {b.manualAttentionReason}
                  </div>

                  {!isResolved && b.eligibleAdmins.length > 0 && (
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Reassign to:</label>
                      <select
                        value={selectedAdmin[b.id] ?? ""}
                        onChange={(e) =>
                          setSelectedAdmin((prev) => ({ ...prev, [b.id]: e.target.value }))
                        }
                        className="text-sm border border-gray-300 rounded-lg px-2 py-1 bg-white dark:border-gray-600 dark:bg-gray-800"
                      >
                        <option value="">Select admin...</option>
                        {b.eligibleAdmins.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => handleResolve(b.id)}
                        disabled={resolving === b.id || !selectedAdmin[b.id]}
                        className="text-xs font-medium text-white bg-brand-500 hover:bg-brand-600 disabled:bg-gray-300 rounded-lg px-3 py-1.5 dark:disabled:bg-gray-700"
                      >
                        {resolving === b.id ? (
                          <Loader2 className="w-3 h-3 animate-spin inline" />
                        ) : (
                          "Confirm"
                        )}
                      </button>
                    </div>
                  )}
                  {!isResolved && b.eligibleAdmins.length === 0 && (
                    <p className="text-xs text-red-600 font-medium dark:text-red-300">
                      No eligible admins currently assigned to this project for this time slot.
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
