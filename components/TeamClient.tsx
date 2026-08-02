"use client";

import { useMemo, useState } from "react";
import { Shield, AlertTriangle, Search, UserPlus } from "lucide-react";
import { changeAdminRoleAction, promoteToOrgOwnerAction, inviteAssociateAction } from "@/lib/actions";
import type { TeamMember } from "@/lib/data/team";
import Avatar from "@/components/Avatar";
import AdminCertificationsEditor from "@/components/AdminCertificationsEditor";

const ROLE_BADGE: Record<string, string> = {
  admin: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
  super_admin: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  org_owner: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
};

const ROLE_OPTIONS = ["admin", "super_admin"] as const;

export default function TeamClient({
  members,
  currentUserId,
  certifications,
  certificationsByAdmin,
}: {
  members: TeamMember[];
  currentUserId: string;
  certifications: { id: string; name: string; description: string }[];
  certificationsByAdmin: Record<string, string[]>;
}) {
  const [saving, setSaving] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [promoteTarget, setPromoteTarget] = useState<TeamMember | null>(null);
  const [confirmPhrase, setConfirmPhrase] = useState("");
  const [promoting, setPromoting] = useState(false);
  const [search, setSearch] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "super_admin">("admin");
  const [inviteSending, setInviteSending] = useState(false);
  const [membersList, setMembersList] = useState(members);

  async function handleInvite() {
    if (!inviteName.trim() || !inviteEmail.trim()) return;
    setInviteSending(true);
    setMsg(null);
    try {
      const invited = await inviteAssociateAction({ name: inviteName.trim(), email: inviteEmail.trim(), role: inviteRole });
      const newMember: TeamMember = {
        id: invited.id,
        name: invited.name,
        email: invited.email,
        role: invited.role,
        accountType: invited.accountType,
        ownedProjectNames: [],
        assignedProjectNames: [],
      };
      setMembersList((prev) => (prev.find((m) => m.id === invited.id) ? prev : [...prev, newMember]));
      setInviteName("");
      setInviteEmail("");
      setInviteOpen(false);
      setMsg({ type: "ok", text: `Invited ${invited.name}. They will receive an activation email.` });
    } catch (err) {
      setMsg({ type: "err", text: err instanceof Error ? err.message : "Failed to invite associate." });
    } finally {
      setInviteSending(false);
    }
  }

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

  const currentOwner = membersList.find((m) => m.role === "org_owner");

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return membersList;
    return membersList.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q),
    );
  }, [membersList, search]);

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

      {membersList.length > 5 && (
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search team by name or email..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800"
          />
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5 mb-6 dark:border-gray-700 dark:bg-gray-900">
        {!inviteOpen ? (
          <button
            onClick={() => setInviteOpen(true)}
            className="inline-flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg px-4 py-2"
          >
            <UserPlus className="w-4 h-4" /> Invite Associate
          </button>
        ) : (
          <div>
            <h2 className="text-sm font-semibold text-gray-900 mb-3 dark:text-gray-50">Invite a new associate</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder="Full name"
                className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white dark:border-gray-600 dark:bg-gray-800"
              />
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="Email address"
                className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white dark:border-gray-600 dark:bg-gray-800"
              />
            </div>
            <div className="flex items-center gap-3 mt-3">
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as "admin" | "super_admin")}
                className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white dark:border-gray-600 dark:bg-gray-800"
              >
                <option value="admin">Associate (Admin)</option>
                <option value="super_admin">Super Admin</option>
              </select>
              <button
                onClick={handleInvite}
                disabled={inviteSending || !inviteName.trim() || !inviteEmail.trim()}
                className="bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg px-4 py-2"
              >
                {inviteSending ? "Inviting..." : "Send Invite"}
              </button>
              <button
                onClick={() => setInviteOpen(false)}
                className="text-sm font-medium text-gray-500 hover:text-gray-700 px-3 py-2 dark:text-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden dark:border-gray-700 dark:bg-gray-900">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-950">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase dark:text-gray-400">Name</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase dark:text-gray-400">Email</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase dark:text-gray-400">Role</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase dark:text-gray-400">Account</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase dark:text-gray-400">Projects</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase dark:text-gray-400">Certifications</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase dark:text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredMembers.map((m) => {
              const isSelf = m.id === currentUserId;
              const isOrgOwner = m.role === "org_owner";
              return (
                <tr key={m.id} className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors dark:border-gray-800 dark:hover:bg-gray-800">
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-50">
                    <div className="flex items-center gap-2">
                      <Avatar name={m.name} seed={m.email} size="sm" />
                      {m.name}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{m.email}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_BADGE[m.role] ?? ""}`}>
                      {m.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{m.accountType ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs dark:text-gray-400">
                    {m.ownedProjectNames.length > 0 && (
                      <span className="block">Owns: {m.ownedProjectNames.join(", ")}</span>
                    )}
                    {m.assignedProjectNames.length > 0 && (
                      <span className="block">Assigned: {m.assignedProjectNames.join(", ")}</span>
                    )}
                    {m.ownedProjectNames.length === 0 && m.assignedProjectNames.length === 0 && "—"}
                  </td>
                  <td className="px-4 py-3">
                    <AdminCertificationsEditor
                      adminId={m.id}
                      catalog={certifications}
                      selected={certificationsByAdmin[m.id] ?? []}
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    {isOrgOwner ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-purple-600 dark:text-purple-300">
                        <Shield className="w-3 h-3" /> Current Org Owner
                      </span>
                    ) : isSelf ? (
                      <span className="text-xs text-gray-400 dark:text-gray-500">You</span>
                    ) : (
                      <div className="flex items-center justify-end gap-2">
                        <select
                          value={m.role}
                          onChange={(e) => handleRoleChange(m.id, e.target.value as "admin" | "super_admin")}
                          disabled={saving === m.id}
                          className="text-xs border border-gray-300 rounded-lg px-2 py-1 bg-white text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
                        >
                          {ROLE_OPTIONS.map((r) => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                        {saving === m.id && <span className="text-xs text-gray-400 dark:text-gray-500">Saving...</span>}
                        <button
                          onClick={() => {
                            setPromoteTarget(m);
                            setConfirmPhrase("");
                          }}
                          className="text-xs text-purple-600 hover:text-purple-800 font-medium flex items-center gap-1 dark:text-purple-300"
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
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                  No team members match your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {promoteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6 dark:bg-gray-900">
            <h2 className="text-lg font-bold text-gray-900 mb-2 dark:text-gray-50">Transfer Org Ownership</h2>
            <p className="text-sm text-gray-600 mb-4 dark:text-gray-400">
              This will transfer Org Owner status to <strong>{promoteTarget.name}</strong> ({promoteTarget.email}) and demote you to <strong>Super Admin</strong>. You will no longer be Org Owner.
            </p>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 flex items-start gap-2 dark:bg-red-900/40 dark:border-red-800">
              <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
              <p className="text-xs text-red-700 dark:text-red-300">
                This is a significant, irreversible action for your account. Only the new org owner can transfer it back.
              </p>
            </div>
            <p className="text-xs text-gray-500 mb-2 dark:text-gray-400">
              Type <strong>{promoteTarget.email}</strong> to confirm:
            </p>
            <input
              type="text"
              value={confirmPhrase}
              onChange={(e) => setConfirmPhrase(e.target.value)}
              placeholder="Type the user's email to confirm"
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2.5 bg-white mb-4 dark:border-gray-600 dark:bg-gray-800"
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setPromoteTarget(null);
                  setConfirmPhrase("");
                }}
                className="text-sm font-medium text-gray-600 hover:text-gray-800 px-4 py-2 dark:text-gray-400"
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
