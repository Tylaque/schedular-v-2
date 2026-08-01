"use client";

import { useMemo, useState } from "react";
import { Shield, AlertTriangle, Search } from "lucide-react";
import { changeAdminRoleAction, promoteToOrgOwnerAction } from "@/lib/actions";
import type { TeamMember } from "@/lib/data/team";
import Avatar from "@/components/Avatar";

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
  const [search, setSearch] = useState("");

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
          cannot_change_org_owner_role: "Org owner role cannot be changed directly. Use the transfer flow.",
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
        setMsg({ type: "ok", text: `Ownership transferred to ${promoteTarget.name}. You are now Super Admin.` });
        setPromoteTarget(null);
        setConfirmPhrase("");
      } else {
        const reasons: Record<string, string> = {
          not_org_owner: "Only the current org owner can transfer ownership.",
          target_not_found: "User not found.",
          already_org_owner: "That user is already the org owner.",
          confirmation_mismatch: "Confirmation phrase does not match the user's email.",
        };
        setMsg({ type: "err", text: reasons[result.reason] ?? "Failed to transfer ownership." });
      }
    } catch {
      setMsg({ type: "err", text: "An error occurred. Please try again." });
    } finally {
      setPromoting(false);
    }
  }

  const currentOwner = members.find((m) => m.role === "org_owner");

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q),
    );
  }, [members, search]);

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

      {members.length > 5 && (
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search team by name or email..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
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
            {filteredMembers.map((m) => {
              const isSelf = m.id === currentUserId;
              const isOrgOwner = m.role === "org_owner";
              return (
                <tr key={m.id} className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    <div className="flex items-center gap-2">
                      <Avatar name={m.name} seed={m.email} size="sm" />
                      {m.name}
                    </div>
                  </td>
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
                    {isOrgOwner ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-purple-600">
                        <Shield className="w-3 h-3" /> Current Org Owner
                      </span>
                    ) : isSelf ? (
                      <span className="text-xs text-gray-400">You</span>
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
            {filteredMembers.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">
                  No team members match your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {promoteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-2">Transfer Org Ownership</h2>
            <p className="text-sm text-gray-600 mb-4">
              This will transfer Org Owner status to <strong>{promoteTarget.name}</strong> ({promoteTarget.email}) and demote you to <strong>Super Admin</strong>. You will no longer be Org Owner.
            </p>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
              <p className="text-xs text-red-700">
                This is a significant, irreversible action for your account. Only the new org owner can transfer it back.
              </p>
            </div>
            <p className="text-xs text-gray-500 mb-2">
              Type <strong>{promoteTarget.email}</strong> to confirm:
            </p>
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
                className="text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:bg-red-300 rounded-lg px-4 py-2 transition-colors"
              >
                {promoting ? "Transferring..." : "Confirm Transfer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
