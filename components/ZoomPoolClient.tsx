"use client";

import { useState } from "react";
import { RefreshCw, Plus, Video, Trash2, Check, X } from "lucide-react";
import {
  createZoomAccountAction,
  setZoomAccountActiveAction,
  deleteZoomAccountAction,
  syncZoomPoolAction,
} from "@/lib/actions";
import type { ZoomAccountWithUsage } from "@/lib/data/zoom";

export default function ZoomPoolClient({
  accounts: initialAccounts,
  configured,
}: {
  accounts: ZoomAccountWithUsage[];
  configured: boolean;
}) {
  const [accounts, setAccounts] = useState(initialAccounts);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [label, setLabel] = useState("");
  const [zoomUserId, setZoomUserId] = useState("");
  const [zoomEmail, setZoomEmail] = useState("");

  async function handleAdd() {
    if (!label.trim() || !zoomUserId.trim() || !zoomEmail.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await createZoomAccountAction({
        label: label.trim(),
        zoomUserId: zoomUserId.trim(),
        zoomEmail: zoomEmail.trim(),
      });
      if (!res.ok) {
        setMsg({ type: "err", text: res.reason });
        return;
      }
      setAccounts((prev) => [
        ...prev,
        { id: res.id, label: label.trim(), zoomUserId: zoomUserId.trim(), zoomEmail: zoomEmail.trim().toLowerCase(), isActive: true, bookingCount: 0 },
      ]);
      setLabel("");
      setZoomUserId("");
      setZoomEmail("");
      setShowAdd(false);
      setMsg({ type: "ok", text: "Pool account added." });
    } catch (err) {
      setMsg({ type: "err", text: err instanceof Error ? err.message : "Failed to add account." });
    } finally {
      setBusy(false);
    }
  }

  async function handleToggle(id: string, isActive: boolean) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await setZoomAccountActiveAction(id, isActive);
      if (!res.ok) {
        setMsg({ type: "err", text: res.reason });
        return;
      }
      setAccounts((prev) => prev.map((a) => (a.id === id ? { ...a, isActive } : a)));
      setMsg({ type: "ok", text: isActive ? "Account enabled." : "Account disabled." });
    } catch (err) {
      setMsg({ type: "err", text: err instanceof Error ? err.message : "Failed to update account." });
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await deleteZoomAccountAction(id);
      if (!res.ok) {
        setMsg({ type: "err", text: res.reason });
        return;
      }
      setAccounts((prev) => prev.filter((a) => a.id !== id));
      setMsg({ type: "ok", text: "Account deleted." });
    } catch (err) {
      setMsg({ type: "err", text: err instanceof Error ? err.message : "Failed to delete account." });
    } finally {
      setBusy(false);
    }
  }

  async function handleSync() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await syncZoomPoolAction();
      if (!res.ok) {
        setMsg({ type: "err", text: res.reason });
        return;
      }
      setMsg({ type: "ok", text: `Synced ${res.synced} user(s) from the Zoom directory.` });
    } catch (err) {
      setMsg({ type: "err", text: err instanceof Error ? err.message : "Sync failed." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {!configured && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-700/50 dark:bg-amber-900/20 dark:text-amber-200">
          Zoom Server-to-Server is not configured. Set <code className="font-mono">ZOOM_ACCOUNT_ID</code>,{" "}
          <code className="font-mono">ZOOM_CLIENT_ID</code> and <code className="font-mono">ZOOM_CLIENT_SECRET</code> in
          your environment to sync and create meetings. You can still manage the pool manually.
        </div>
      )}

      {msg && (
        <div className={`rounded-lg border p-3 text-sm ${msg.type === "ok" ? "border-green-300 bg-green-50 text-green-800 dark:border-green-700/50 dark:bg-green-900/20 dark:text-green-200" : "border-red-300 bg-red-50 text-red-800 dark:border-red-700/50 dark:bg-red-900/20 dark:text-red-200"}`}>
          {msg.text}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {accounts.length} account(s), {accounts.filter((a) => a.isActive).length} active
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSync}
            disabled={busy || !configured}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            <RefreshCw className="w-4 h-4" /> Sync from Zoom
          </button>
          <button
            onClick={() => setShowAdd((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <Plus className="w-4 h-4" /> Add account
          </button>
        </div>
      </div>

      {showAdd && (
        <div className="rounded-lg border border-gray-200 p-4 space-y-3 dark:border-gray-700">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Label (e.g. Zoom Account 1)"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
            <input
              value={zoomUserId}
              onChange={(e) => setZoomUserId(e.target.value)}
              placeholder="Zoom user ID"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
            <input
              value={zoomEmail}
              onChange={(e) => setZoomEmail(e.target.value)}
              placeholder="Zoom login email"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" /> Save account
            </button>
            <button onClick={() => setShowAdd(false)} className="rounded-lg px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-gray-200 overflow-hidden dark:border-gray-700">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500 dark:bg-gray-800 dark:text-gray-400">
            <tr>
              <th className="px-4 py-2.5">Account</th>
              <th className="px-4 py-2.5">Zoom user</th>
              <th className="px-4 py-2.5 text-center">Confirmed bookings</th>
              <th className="px-4 py-2.5 text-center">Status</th>
              <th className="px-4 py-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {accounts.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  <Video className="w-6 h-6 mx-auto mb-2 opacity-40" />
                  No pool accounts yet. Add one or sync from your Zoom directory.
                </td>
              </tr>
            )}
            {accounts.map((a) => (
              <tr key={a.id} className={a.isActive ? "" : "opacity-50"}>
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                  {a.label}
                  {!a.isActive && <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400">disabled</span>}
                </td>
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                  {a.zoomEmail}
                  <div className="text-xs text-gray-400 font-mono">{a.zoomUserId}</div>
                </td>
                <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-300">{a.bookingCount}</td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => handleToggle(a.id, !a.isActive)}
                    disabled={busy}
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${a.isActive ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"}`}
                  >
                    {a.isActive ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                    {a.isActive ? "Active" : "Disabled"}
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleDelete(a.id)}
                    disabled={busy || a.bookingCount > 0}
                    title={a.bookingCount > 0 ? "Has booking history — disable instead" : "Delete account"}
                    className="inline-flex items-center gap-1 rounded-lg p-1.5 text-gray-400 hover:text-red-600 disabled:opacity-40"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
