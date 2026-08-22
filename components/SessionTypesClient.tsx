"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";
import {
  createSessionTypeAction,
  updateSessionTypeAction,
  deleteSessionTypeAction,
} from "@/lib/actions";
import type { SessionTypeRecord } from "@/lib/data/session-types";

export default function SessionTypesClient({
  sessionTypes,
}: {
  sessionTypes: SessionTypeRecord[];
}) {
  const [items, setItems] = useState(sessionTypes);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const [createName, setCreateName] = useState("");
  const [createDesc, setCreateDesc] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");

  function showError(err: unknown, fallback: string) {
    const reason =
      typeof err === "object" && err !== null && "reason" in err
        ? String((err as { reason: string }).reason)
        : "";
    setMsg({ type: "err", text: reason || fallback });
  }

  async function handleCreate() {
    setSaving(true);
    setMsg(null);
    try {
      const result = await createSessionTypeAction(createName, createDesc);
      if (result.ok) {
        setItems((prev) => [...prev, { id: result.id, name: result.name, description: result.description, isActive: result.isActive }]);
        setCreateName("");
        setCreateDesc("");
        setMsg({ type: "ok", text: "Session type added." });
      } else {
        setMsg({ type: "err", text: result.reason });
      }
    } catch (err) {
      showError(err, "Failed to add session type.");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(item: SessionTypeRecord) {
    setEditingId(item.id);
    setEditName(item.name);
    setEditDesc(item.description);
  }

  async function handleUpdate() {
    if (!editingId) return;
    setSaving(true);
    setMsg(null);
    try {
      const result = await updateSessionTypeAction(editingId, editName, editDesc);
      if (result.ok) {
        setItems((prev) => prev.map((c) => (c.id === editingId ? { ...c, name: result.name, description: result.description } : c)));
        setEditingId(null);
        setMsg({ type: "ok", text: "Session type updated." });
      } else {
        setMsg({ type: "err", text: result.reason });
      }
    } catch (err) {
      showError(err, "Failed to update session type.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Deactivate this session type? Historical bookings that recorded it will retain the type name.")) {
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      const result = await deleteSessionTypeAction(id);
      if (result.ok) {
        setItems((prev) => prev.filter((c) => c.id !== id));
        setMsg({ type: "ok", text: "Session type deactivated." });
      } else {
        setMsg({ type: "err", text: result.reason });
      }
    } catch (err) {
      showError(err, "Failed to deactivate session type.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {msg && (
        <div
          className={`mb-4 p-3 rounded-lg text-sm ${
            msg.type === "ok"
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/40 dark:border-emerald-800 dark:text-emerald-300"
              : "bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/40 dark:border-red-800 dark:text-red-300"
          }`}
        >
          {msg.text}
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5 mb-6 dark:border-gray-700 dark:bg-gray-900">
        <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2 dark:text-gray-50">
          <Plus className="w-4 h-4 text-gray-400" /> Add a session type
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            type="text"
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            placeholder="Session type name (e.g. Interview)"
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white dark:border-gray-600 dark:bg-gray-800"
          />
          <input
            type="text"
            value={createDesc}
            onChange={(e) => setCreateDesc(e.target.value)}
            placeholder="Short description (optional)"
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white dark:border-gray-600 dark:bg-gray-800"
          />
        </div>
        <button
          onClick={handleCreate}
          disabled={saving || !createName.trim()}
          className="mt-3 inline-flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg px-4 py-2"
        >
          <Plus className="w-4 h-4" /> Add session type
        </button>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden dark:border-gray-700 dark:bg-gray-900">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-950">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase dark:text-gray-400">Name</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase dark:text-gray-400">Description</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase dark:text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) =>
              editingId === c.id ? (
                <tr key={c.id} className="border-b border-gray-100 last:border-b-0 bg-amber-50/50 dark:border-gray-800 dark:bg-amber-900/10">
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white dark:border-gray-600 dark:bg-gray-800"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white dark:border-gray-600 dark:bg-gray-800"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={handleUpdate}
                        disabled={saving || !editName.trim()}
                        className="inline-flex items-center gap-1 text-sm font-semibold text-white bg-brand-500 hover:bg-brand-600 disabled:opacity-50 rounded-lg px-3 py-1.5"
                      >
                        <Check className="w-4 h-4" /> Save
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 px-2 py-1.5 dark:text-gray-400"
                      >
                        <X className="w-4 h-4" /> Cancel
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={c.id} className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors dark:border-gray-800 dark:hover:bg-gray-800">
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-50">{c.name}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{c.description || "\u2014"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => startEdit(c)}
                        className="p-1.5 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(c.id)}
                        className="p-1.5 text-red-500 hover:text-red-700 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30"
                        title="Deactivate"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            )}
            {items.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                  No session types yet. Add the first one above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
