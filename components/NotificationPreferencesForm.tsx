"use client";

import { useState } from "react";
import { Bell, Check } from "lucide-react";
import { updateNotificationPreferencesAction } from "@/lib/actions";

export default function NotificationPreferencesForm({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  async function handleSave() {
    setSaving(true);
    setMsg(null);
    try {
      const result = await updateNotificationPreferencesAction(enabled);
      if (result.ok) {
        setMsg({ type: "ok", text: "Preference saved." });
      } else {
        setMsg({ type: "err", text: result.reason ?? "Failed to save preference." });
      }
    } catch {
      setMsg({ type: "err", text: "Failed to save preference." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4 dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-start gap-3">
        <Bell className="w-5 h-5 text-gray-400 mt-0.5 dark:text-gray-500" />
        <div className="flex-1">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">Booking notifications</h2>
          <p className="text-xs text-gray-500 mt-1 dark:text-gray-400">
            Email me when a booking is created, rescheduled, or cancelled on a project I&apos;m assigned to or own.
          </p>
        </div>
      </div>

      <label className="flex items-start gap-3 mt-4 cursor-pointer">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => {
            setEnabled(e.target.checked);
            setMsg(null);
          }}
          className="mt-0.5 w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 dark:border-gray-600"
        />
        <span className="text-sm text-gray-700 dark:text-gray-300">
          Receive booking notification emails
        </span>
      </label>

      <div className="flex items-center gap-3 mt-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {msg?.type === "ok" ? <Check className="w-4 h-4" /> : null}
          {saving ? "Saving…" : "Save"}
        </button>
        {msg && (
          <span className={`text-sm ${msg.type === "ok" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
            {msg.text}
          </span>
        )}
      </div>
    </div>
  );
}
