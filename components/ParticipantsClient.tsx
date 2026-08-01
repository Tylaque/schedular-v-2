"use client";

import { useState, useRef } from "react";
import {
  Upload,
  Download,
  Mail,
  Trash2,
  UserPlus,
  Loader2,
  Copy,
  Check,
} from "lucide-react";
import {
  addParticipantAction,
  sendInvitesNowAction,
  removeParticipantAction,
} from "@/lib/actions";

type Participant = {
  id: string;
  name: string;
  email: string;
  status: string;
  lastInvitedAt: Date | null;
  createdAt: Date;
};

export default function ParticipantsClient({
  participants,
  projectId,
  projectSlug,
  projectStatus,
}: {
  participants: Participant[];
  projectId: string;
  projectSlug: string;
  projectStatus: string;
}) {
  const [adding, setAdding] = useState(false);
  const [addName, setAddName] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [uploading, setUploading] = useState(false);
  const [importResult, setImportResult] = useState<{
    imported: number;
    skipped: number;
    errors: { row: number; name: string; email: string; reason: string }[];
  } | null>(null);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ sent: number; failed: number } | null>(null);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const baseUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

  async function handleAdd() {
    if (!addName.trim() || !addEmail.trim()) return;
    setAdding(true);
    setMsg(null);
    try {
      const result = await addParticipantAction(projectId, addName.trim(), addEmail.trim());
      if (result.ok) {
        setMsg({
          type: "ok",
          text: result.emailSent
            ? "Participant added and invitation sent."
            : "Participant added. Invitation will be sent when project is activated.",
        });
        setAddName("");
        setAddEmail("");
      } else {
        setMsg({ type: "err", text: result.reason });
      }
    } catch {
      setMsg({ type: "err", text: "Failed to add participant." });
    } finally {
      setAdding(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setImportResult(null);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append("projectId", projectId);
      fd.append("file", file);
      const res = await fetch("/api/participants/import", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ type: "err", text: data.error ?? "Import failed" });
      } else {
        setImportResult(data);
        setMsg({
          type: "ok",
          text: `Imported ${data.imported} participant(s). ${data.skipped} skipped. ${data.errors.length} error(s).`,
        });
      }
    } catch {
      setMsg({ type: "err", text: "File upload failed." });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleSendInvites() {
    setSending(true);
    setSendResult(null);
    setMsg(null);
    try {
      const result = await sendInvitesNowAction(projectId);
      if (result.ok) {
        setSendResult({ sent: result.sent, failed: result.failed });
        setMsg({
          type: "ok",
          text: `Sent ${result.sent} invitation(s). ${result.failed} failed.`,
        });
      } else {
        setMsg({ type: "err", text: result.reason });
      }
    } catch {
      setMsg({ type: "err", text: "Failed to send invitations." });
    } finally {
      setSending(false);
    }
  }

  async function handleRemove(id: string) {
    if (!confirm("Remove this participant?")) return;
    setMsg(null);
    try {
      const result = await removeParticipantAction(id);
      if (!result.ok) {
        setMsg({ type: "err", text: result.reason });
      }
    } catch {
      setMsg({ type: "err", text: "Failed to remove participant." });
    }
  }

  async function copyLink(participantId: string) {
    const link = `${baseUrl}/book/${projectSlug}/p/${participantId}`;
    await navigator.clipboard.writeText(link);
    setCopiedId(participantId);
    setTimeout(() => setCopiedId(null), 2000);
  }

  const STATUS_BADGE: Record<string, string> = {
    invited: "bg-yellow-100 text-yellow-700",
    link_sent: "bg-blue-100 text-blue-700",
    booked: "bg-green-100 text-green-700",
    reminded: "bg-orange-100 text-orange-700",
    completed: "bg-emerald-100 text-emerald-700",
    no_show: "bg-red-100 text-red-700",
    cancelled: "bg-gray-100 text-gray-500",
    waitlisted: "bg-purple-100 text-purple-700",
  };

  const pendingCount = participants.filter((p) =>
    ["invited", "link_sent", "reminded"].includes(p.status)
  ).length;

  return (
    <div>
      {msg && (
        <div
          className={`mb-4 rounded-lg p-3 text-sm ${
            msg.type === "ok"
              ? "bg-green-50 border border-green-200 text-green-700"
              : "bg-red-50 border border-red-200 text-red-700"
          }`}
        >
          {msg.text}
        </div>
      )}

      <div className="flex flex-wrap gap-3 mb-6">
        <button
          onClick={() => window.open("/api/participants/template", "_blank")}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium border border-gray-300 rounded-lg bg-white hover:bg-gray-50 text-gray-700"
        >
          <Download className="w-4 h-4" /> Download template
        </button>
        <label className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium border border-gray-300 rounded-lg bg-white hover:bg-gray-50 text-gray-700 cursor-pointer">
          <Upload className="w-4 h-4" /> {uploading ? "Uploading..." : "Import file"}
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.csv"
            className="hidden"
            onChange={handleFileUpload}
            disabled={uploading}
          />
        </label>
        <button
          onClick={handleSendInvites}
          disabled={sending || pendingCount === 0}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-brand-500 hover:bg-brand-600 disabled:bg-gray-300 text-white"
        >
          {sending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Mail className="w-4 h-4" />
          )}
          Send invites now {pendingCount > 0 ? `(${pendingCount})` : ""}
        </button>
      </div>

      <div className="border border-gray-200 rounded-lg mb-6 bg-white shadow-sm">
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-brand-500" /> Add participant
          </h3>
        </div>
        <div className="p-4 flex gap-3 items-end">
          <div className="flex-1">
            <label className="text-xs font-medium text-gray-500">Name</label>
            <input
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
              placeholder="Jane Doe"
              className="w-full mt-1 text-sm border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>
          <div className="flex-1">
            <label className="text-xs font-medium text-gray-500">Email</label>
            <input
              value={addEmail}
              onChange={(e) => setAddEmail(e.target.value)}
              placeholder="jane@email.com"
              className="w-full mt-1 text-sm border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>
          <button
            onClick={handleAdd}
            disabled={adding || !addName.trim() || !addEmail.trim()}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-brand-500 hover:bg-brand-600 disabled:bg-gray-300 text-white flex items-center gap-2"
          >
            {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            Add
          </button>
        </div>
      </div>

      {importResult && importResult.errors.length > 0 && (
        <div className="border border-red-200 rounded-lg mb-6 bg-white">
          <div className="p-4 border-b border-red-100">
            <h3 className="text-sm font-semibold text-red-700">
              Import errors ({importResult.errors.length})
            </h3>
          </div>
          <div className="p-4 overflow-x-auto">
            <table className="text-sm w-full">
              <thead>
                <tr className="text-left text-gray-500">
                  <th className="pb-2 pr-4">Row</th>
                  <th className="pb-2 pr-4">Name</th>
                  <th className="pb-2 pr-4">Email</th>
                  <th className="pb-2">Reason</th>
                </tr>
              </thead>
              <tbody>
                {importResult.errors.map((err, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="py-2 pr-4 text-gray-500">{err.row}</td>
                    <td className="py-2 pr-4">{err.name}</td>
                    <td className="py-2 pr-4">{err.email}</td>
                    <td className="py-2 text-red-600">{err.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="border border-gray-200 rounded-lg bg-white overflow-hidden shadow-sm">
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900">
            Participants ({participants.length})
          </h3>
        </div>
        {participants.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">
            No participants yet. Add one above or import from a file.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-gray-500">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Invited</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {participants.map((p) => (
                  <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                    <td className="px-4 py-3 text-gray-600">{p.email}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          STATUS_BADGE[p.status] ?? "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {p.lastInvitedAt
                        ? new Date(p.lastInvitedAt).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => copyLink(p.id)}
                          className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                          title="Copy booking link"
                        >
                          {copiedId === p.id ? (
                            <Check className="w-4 h-4 text-green-500" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => handleRemove(p.id)}
                          className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"
                          title="Remove"
                        >
                          <Trash2 className="w-4 h-4" />
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
    </div>
  );
}
