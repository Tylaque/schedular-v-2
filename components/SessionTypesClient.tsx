"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, Check, X, RefreshCw } from "lucide-react";
import {
  createSessionTypeAction,
  updateSessionTypeAction,
  deleteSessionTypeAction,
  reactivateSessionTypeAction,
} from "@/lib/actions";
import type { SessionTypeRecord } from "@/lib/data/session-types";

type Classification = "STANDARD" | "FEEDBACK";

const CLASSIFICATION_OPTIONS: { value: Classification; label: string; hint: string }[] = [
  { value: "STANDARD", label: "Standard", hint: "Show interviewer name in notifications" },
  { value: "FEEDBACK", label: "Feedback", hint: "Hide interviewer name in participant notifications" },
];

export default function SessionTypesClient({
  sessionTypes,
  allSessionTypes,
}: {
  sessionTypes: SessionTypeRecord[];
  allSessionTypes: SessionTypeRecord[];
}) {
  const [items, setItems] = useState(sessionTypes);
  const [allItems, setAllItems] = useState(allSessionTypes);
  const [showDeactivated, setShowDeactivated] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const [createName, setCreateName] = useState("");
  const [createDesc, setCreateDesc] = useState("");
  const [createClass, setCreateClass] = useState<Classification>("STANDARD");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editClass, setEditClass] = useState<Classification>("STANDARD");

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
      const result = await createSessionTypeAction(createName, createDesc, createClass);
      if (result.ok) {
        const newItem = { id: result.id, name: result.name, description: result.description, classification: result.classification as Classification, isActive: result.isActive };
        setItems((prev) => [...prev, newItem]);
        setAllItems((prev) => [...prev, newItem]);
        setCreateName("");
        setCreateDesc("");
        setCreateClass("STANDARD");
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
    setEditClass(item.classification as Classification);
  }

  async function handleUpdate() {
    if (!editingId) return;
    setSaving(true);
    setMsg(null);
    try {
      const result = await updateSessionTypeAction(editingId, editName, editDesc, editClass);
      if (result.ok) {
        setItems((prev) => prev.map((c) => (c.id === editingId ? { ...c, name: result.name, description: result.description, classification: result.classification as Classification } : c)));
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
        setAllItems((prev) => prev.map((c) => (c.id === id ? { ...c, isActive: false } : c)));
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

  async function handleReactivate(id: string) {
    setSaving(true);
    setMsg(null);
    try {
      const result = await reactivateSessionTypeAction(id);
      if (result.ok) {
        setAllItems((prev) => prev.map((c) => (c.id === id ? { ...c, isActive: true } : c)));
        setItems((prev) => {
          const reactivated = allItems.find((c) => c.id === id);
          if (!reactivated) return prev;
          return [...prev, { ...reactivated, isActive: true }].sort((a, b) => a.name.localeCompare(b.name));
        });
        setMsg({ type: "ok", text: "Session type reactivated." });
      } else {
        setMsg({ type: "err", text: result.reason });
      }
    } catch (err) {
      showError(err, "Failed to reactivate session type.");
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
          <select
            value={createClass}
            onChange={(e) => setCreateClass(e.target.value as Classification)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white dark:border-gray-600 dark:bg-gray-800"
          >
            {CLASSIFICATION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label} — {opt.hint}</option>
            ))}
          </select>
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
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase dark:text-gray-400">Classification</th>
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
                    <select
                      value={editClass}
                      onChange={(e) => setEditClass(e.target.value as Classification)}
                      className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white dark:border-gray-600 dark:bg-gray-800"
                    >
                      {CLASSIFICATION_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
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
                    <span className={`inline-flex items-center text-xs font-medium rounded-full px-2.5 py-0.5 ${
                      c.classification === "FEEDBACK"
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                        : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                    }`}>
                      {CLASSIFICATION_OPTIONS.find(o => o.value === c.classification)?.label ?? c.classification}
                    </span>
                  </td>
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
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                  No session types yet. Add the first one above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {allItems.some((c) => !c.isActive) && (
        <div className="mt-6">
          <button
            onClick={() => setShowDeactivated(!showDeactivated)}
            className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 flex items-center gap-1 mb-3"
          >
            {showDeactivated ? "Hide" : "Show"} deactivated ({allItems.filter((c) => !c.isActive).length})
          </button>
          {showDeactivated && (
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden dark:border-gray-700 dark:bg-gray-900">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-950">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase dark:text-gray-400">Name</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase dark:text-gray-400">Description</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase dark:text-gray-400">Classification</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase dark:text-gray-400">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {allItems.filter((c) => !c.isActive).map((c) => (
                    <tr key={c.id} className="border-b border-gray-100 last:border-b-0 opacity-60 dark:border-gray-800">
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-50">{c.name}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{c.description || "\u2014"}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center text-xs font-medium rounded-full px-2.5 py-0.5 ${
                          c.classification === "FEEDBACK"
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                            : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                        }`}>
                          {CLASSIFICATION_OPTIONS.find(o => o.value === c.classification)?.label ?? c.classification}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end">
                          <button
                            onClick={() => handleReactivate(c.id)}
                            disabled={saving}
                            className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-600 hover:text-emerald-700 disabled:opacity-50 dark:text-emerald-400 dark:hover:text-emerald-300"
                          >
                            <RefreshCw className="w-3.5 h-3.5" /> Reactivate
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
