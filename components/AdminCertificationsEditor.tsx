"use client";

import { useState } from "react";
import { BadgeCheck, ChevronDown, ChevronUp } from "lucide-react";
import { setAdminCertificationsAction } from "@/lib/actions";

export default function AdminCertificationsEditor({
  adminId,
  catalog,
  selected,
}: {
  adminId: string;
  catalog: { id: string; name: string }[];
  selected: string[];
}) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<string[]>(selected);
  const [draft, setDraft] = useState<string[]>(selected);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const selectedNames = catalog.filter((c) => current.includes(c.id)).map((c) => c.name);

  function toggle(id: string) {
    setDraft((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function save() {
    setSaving(true);
    setErr(null);
    try {
      const result = await setAdminCertificationsAction(adminId, draft);
      if (result.ok) {
        setCurrent(draft);
        setOpen(false);
      } else {
        setErr(result.reason === "unauthorized" ? "You are not allowed to manage this associate." : result.reason);
      }
    } catch {
      setErr("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    setDraft(current);
    setOpen(false);
    setErr(null);
  }

  return (
    <div className="relative inline-block text-left">
      <button
        onClick={() => {
          setOpen((o) => !o);
          setDraft(current);
          setErr(null);
        }}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg px-2 py-1 bg-white dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:text-gray-100"
        title="Manage certifications"
      >
        <BadgeCheck className="w-3.5 h-3.5 text-brand-500" />
        Certifications ({current.length})
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>

      {open && (
        <div className="absolute z-40 mt-2 right-0 w-72 max-w-[90vw] rounded-xl border border-gray-200 bg-white shadow-xl p-4 dark:border-gray-700 dark:bg-gray-900">
          <p className="text-xs font-semibold text-gray-900 mb-2 dark:text-gray-50">Certifications</p>
          {selectedNames.length > 0 && (
            <p className="text-xs text-gray-500 mb-2 dark:text-gray-400">
              Currently: {selectedNames.join(", ")}
            </p>
          )}
          <div className="max-h-56 overflow-y-auto space-y-1.5 mb-3">
            {catalog.length === 0 && (
              <p className="text-xs text-gray-400 dark:text-gray-500">
                No certifications in the catalog yet.
              </p>
            )}
            {catalog.map((c) => (
              <label
                key={c.id}
                className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer hover:bg-gray-50 rounded px-1.5 py-1 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                <input
                  type="checkbox"
                  checked={draft.includes(c.id)}
                  onChange={() => toggle(c.id)}
                  className="rounded border-gray-300 text-brand-500 dark:border-gray-600"
                />
                {c.name}
              </label>
            ))}
          </div>
          {err && <p className="text-xs text-red-600 mb-2 dark:text-red-400">{err}</p>}
          <div className="flex justify-end gap-2">
            <button
              onClick={cancel}
              className="text-xs font-medium text-gray-500 hover:text-gray-700 px-3 py-1.5 dark:text-gray-400"
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="text-xs font-semibold text-white bg-brand-500 hover:bg-brand-600 disabled:opacity-50 rounded-lg px-3 py-1.5"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
