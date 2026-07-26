"use client";

import { useState } from "react";
import { Shield, ChevronDown, AlertTriangle } from "lucide-react";
import { changeAdminRoleAction, promoteToOrgOwnerAction } from "@/lib/actions";
import type { TeamMember } from "@/lib/data/team";

const ROLE_BADGE: Record<string, string> = {
  admin: "bg-gray-100 text-gray-600",
  super_admin: "bg-blue-100 text-blue-700",
  org_owner: "bg-purple-100 text-purple-700",
};

const ROLE_OPTIONS = ["admin", "super_admin"] as const;

export default function TeamClient({
  members,
  currentUserId,
}: {
  members: TeamMember[];
  currentUserId: string;
}) {
  const [saving, setSaving] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [promoteTarget, setPromoteTarget] = useState<TeamMember | null>(null);
  const [confirmPhrase, setConfirmPhrase] = useState("");
  const [promoting, setPromoting] = useState(false);

  async function handleRoleChange(memberId: string, newRole: "admin" | "super_admin") {
    setSaving(memberId);
    setMsg(null);
    try {
      const result = await changeAdminRoleAction(memberId, newRole);
      if (result.ok) {
        setMsg({ type: "ok", text: "Role updated successfully." });
      } else {
        const reasons: Record<string, string> = {
          not_org_owner: "Only org owners can change roles.",
          target_not_found: "User not found.",
          cannot_demote_last_org_owner: "Cannot demote the last org owner.",
          self_demotion_blocked: "You cannot demote yourself. Ask another org owner to do it.",
        };
        setMsg({ type: "err", text: reasons[result.reason] ?? "Failed to update role." });
      }
    } catch {
      setMsg({ type: "err", text: "An error occurred. Please try again." });
    } finally {
      setSaving(null);
    }
  }

  async function handlePromote() {
    if (!promoteTarget) return;
    setPromoting(true);
    setMsg(null);
    try {
      const result = await promoteToOrgOwnerAction(promoteTarget.id, confirmPhrase);
      if (result.ok) {
        setMsg({ type: "ok", text: `${promoteTarget.name} promoted to org owner.` });
        setPromoteTarget(null);
        setConfirmPhrase("");
      } else {
        const reasons: Record<string, string> = {
          not_org_owner: "Only org owners can promote.",
          target_not_found: "User not found.",
          confirmation_mismatch: "Confirmation phrase does not match the user's email.",
        };
        setMsg({ type: "err", text: reasons[result.reason] ?? "Failed to promote." });
      }
    } catch {
      setMsg({ type: "err", text: "An error occurred. Please try again." });
    } finally {
      setPromoting(false);
    }
  }

  return (
    <div>
      {msg && (
        <div
          className={`mb-4 p-3 rounded-lg text-sm ${
            msg.type === "ok"
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {msg.text}
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Name</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Email</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Role</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Account</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Projects</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const isSelf = m.id === currentUserId;
              return (
                <tr key={m.id} className="border-b border-gray-100 last:border-b-0">
                  <td className="px-4 py-3 font-medium text-gray-900">{m.name}</td>
                  <td className="px-4 py-3 text-gray-600">{m.email}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_BADGE[m.role] ?? ""}`}>
                      {m.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{m.accountType ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {m.ownedProjectNames.length > 0 && (
                      <span className="block">Owns: {m.ownedProjectNames.join(", ")}</span>
                    )}
                    {m.assignedProjectNames.length > 0 && (
                      <span className="block">Assigned: {m.assignedProjectNames.join(", ")}</span>
                    )}
                    {m.ownedProjectNames.length === 0 && m.assignedProjectNames.length === 0 && "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {isSelf ? (
                      <span className="text-xs text-gray-400">You</span>
                    ) : m.role === "org_owner" ? (
                      <div className="flex items-center justify-end gap-2">
                        <select
                          value=""
                          onChange={(e) => {
                            if (e.target.value) handleRoleChange(m.id, e.target.value as "admin" | "super_admin");
                          }}
                          disabled={saving === m.id}
                          className="text-xs border border-gray-300 rounded-lg px-2 py-1 bg-white text-gray-700"
                        >
                          <option value="" disabled>Demote to...</option>
                          {ROLE_OPTIONS.map((r) => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                        {saving === m.id && <span className="text-xs text-gray-400">Saving...</span>}
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-2">
                        <select
                          value={m.role}
                          onChange={(e) => handleRoleChange(m.id, e.target.value as "admin" | "super_admin")}
                          disabled={saving === m.id}
                          className="text-xs border border-gray-300 rounded-lg px-2 py-1 bg-white text-gray-700"
                        >
                          {ROLE_OPTIONS.map((r) => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                        {saving === m.id && <span className="text-xs text-gray-400">Saving...</span>}
                        <button
                          onClick={() => {
                            setPromoteTarget(m);
                            setConfirmPhrase("");
                          }}
                          className="text-xs text-purple-600 hover:text-purple-800 font-medium flex items-center gap-1"
                        >
                          <Shield className="w-3 h-3" /> Promote
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {promoteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-2">Promote to Org Owner</h2>
            <p className="text-sm text-gray-500 mb-4">
              This grants <strong>{promoteTarget.name}</strong> ({promoteTarget.email}) full org-owner privileges including the ability to manage team roles and projects.
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-700">
                This is a high-privilege action. Type <strong>{promoteTarget.email}</strong> below to confirm.
              </p>
            </div>
            <input
              type="text"
              value={confirmPhrase}
              onChange={(e) => setConfirmPhrase(e.target.value)}
              placeholder="Type the user's email to confirm"
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2.5 bg-white mb-4"
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setPromoteTarget(null);
                  setConfirmPhrase("");
                }}
                className="text-sm font-medium text-gray-600 hover:text-gray-800 px-4 py-2"
              >
                Cancel
              </button>
              <button
                onClick={handlePromote}
                disabled={promoting || confirmPhrase !== promoteTarget.email}
                className="text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 rounded-lg px-4 py-2 transition-colors"
              >
                {promoting ? "Promoting..." : "Confirm Promotion"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
