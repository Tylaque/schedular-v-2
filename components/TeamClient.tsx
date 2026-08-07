"use client";

import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { Shield, AlertTriangle, Search, UserPlus, UserX, RotateCcw, Users, UserSearch } from "lucide-react";
import { changeAdminRoleAction, promoteToOrgOwnerAction, inviteAssociateAction, deactivateAdminAction, reactivateAdminAction } from "@/lib/actions";
import type { TeamMember } from "@/lib/data/team";
import Avatar from "@/components/Avatar";
import AdminCertificationsEditor from "@/components/AdminCertificationsEditor";
import EmptyState from "@/components/shared/EmptyState";
import { designTokens, dtScreenVars, roleChip, roleDot, statusChip, cardTitleStyle } from "@/lib/design-tokens";

const ROLE_OPTIONS = ["admin", "super_admin"] as const;

export default function TeamClient({
  members,
  currentUserId,
  currentUserRole,
  certifications,
  certificationsByAdmin,
}: {
  members: TeamMember[];
  currentUserId: string;
  currentUserRole?: string;
  certifications: { id: string; name: string; description: string }[];
  certificationsByAdmin: Record<string, string[]>;
}) {
  const [saving, setSaving] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [promoteTarget, setPromoteTarget] = useState<TeamMember | null>(null);
  const [confirmPhrase, setConfirmPhrase] = useState("");
  const [promoting, setPromoting] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "admin" | "super_admin" | "org_owner">("all");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "super_admin">("admin");
  const [inviteSending, setInviteSending] = useState(false);
  const [membersList, setMembersList] = useState(members);
  const [deactivateTarget, setDeactivateTarget] = useState<TeamMember | null>(null);
  const [deactivating, setDeactivating] = useState(false);

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
        isActive: true,
        deactivatedAt: null,
        deactivatedBy: null,
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
        setMembersList((prev) =>
          prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m))
        );
        setMsg({ type: "ok", text: "Role updated successfully." });
      } else {
        const reasons: Record<string, string> = {
          not_allowed: "Only org owners and super admins can change roles.",
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

  async function handleDeactivate() {
    if (!deactivateTarget) return;
    setDeactivating(true);
    setMsg(null);
    try {
      const result = await deactivateAdminAction(deactivateTarget.id);
      if (result.ok) {
        setMembersList((prev) =>
          prev.map((m) =>
            m.id === deactivateTarget.id ? { ...m, isActive: false, deactivatedAt: new Date().toISOString(), deactivatedBy: currentUserId, assignedProjectNames: [] } : m
          )
        );
        const offboardNote = result.offboarding.reassigned + result.offboarding.flagged;
        setMsg({
          type: "ok",
          text: `${deactivateTarget.name} deactivated. Removed from ${result.projectsRemoved} project(s); ${offboardNote} future booking(s) handled by off-boarding.`,
        });
        setDeactivateTarget(null);
      } else {
        const reasons: Record<string, string> = {
          not_authorized: "Only org owners and super admins can deactivate associates.",
          target_not_found: "User not found.",
          cannot_deactivate_self: "You cannot deactivate yourself. Another org owner/super admin must do it.",
          cannot_deactivate_sole_org_owner: "The org owner cannot be deactivated â€” the system must always have an org owner.",
        };
        setMsg({ type: "err", text: reasons[result.reason] ?? "Failed to deactivate." });
        setDeactivateTarget(null);
      }
    } catch {
      setMsg({ type: "err", text: "An error occurred. Please try again." });
    } finally {
      setDeactivating(false);
    }
  }

  async function handleReactivate(member: TeamMember) {
    setSaving(member.id);
    setMsg(null);
    try {
      const result = await reactivateAdminAction(member.id);
      if (result.ok) {
        setMembersList((prev) => prev.map((m) => (m.id === member.id ? { ...m, isActive: true, deactivatedAt: null, deactivatedBy: null } : m)));
        setMsg({ type: "ok", text: `${member.name} reactivated. Their old project assignments were NOT restored â€” re-assign them if needed.` });
      } else {
        const reasons: Record<string, string> = {
          not_authorized: "Only org owners and super admins can reactivate associates.",
          target_not_found: "User not found.",
        };
        setMsg({ type: "err", text: reasons[result.reason] ?? "Failed to reactivate." });
      }
    } catch {
      setMsg({ type: "err", text: "An error occurred. Please try again." });
    } finally {
      setSaving(null);
    }
  }

  const canManage = currentUserRole === "org_owner" || currentUserRole === "super_admin";

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return membersList.filter((m) => {
      if (roleFilter !== "all" && m.role !== roleFilter) return false;
      if (!q) return true;
      return (
        m.name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q)
      );
    });
  }, [membersList, search, roleFilter]);

  const thStyle: CSSProperties = {
    textAlign: "left",
    padding: "10px 14px",
    fontSize: designTokens.type.overline.size,
    fontWeight: designTokens.type.overline.weight,
    letterSpacing: designTokens.type.overline.letterSpacing,
    textTransform: "uppercase",
    whiteSpace: "nowrap",
  };
  const tdStyle: CSSProperties = {
    padding: "12px 14px",
    verticalAlign: "middle",
  };
  const controlStyle: CSSProperties = {
    padding: "9px 12px",
    fontSize: designTokens.type.body.size,
    borderRadius: designTokens.radius.control,
    cursor: "pointer",
  };
  const actionBtnStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    fontSize: designTokens.type.caption.size,
    fontWeight: 600,
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: 0,
  };
  const modalTitleStyle: CSSProperties = {
    ...cardTitleStyle,
    fontSize: 18,
    fontWeight: 700,
  };

  return (
    <div style={dtScreenVars()}>
      {msg && (
        <div
          className="dt-chip"
          style={{
            marginBottom: 16,
            padding: "10px 14px",
            borderRadius: designTokens.radius.control,
            fontSize: designTokens.type.body.size,
            fontWeight: designTokens.type.meta.weight,
          }}
        >
          <span className={msg.type === "ok" ? "dt-ok-text" : "dt-danger-text"}>{msg.text}</span>
        </div>
      )}

      {membersList.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: designTokens.color.text.muted }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search team by name or email..."
              className="dt-search dt-text-primary"
              style={{
                width: "100%",
                padding: "9px 12px 9px 34px",
                fontSize: designTokens.type.body.size,
                borderRadius: designTokens.radius.control,
              }}
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as typeof roleFilter)}
            aria-label="Filter by role"
            className="dt-search dt-text-primary"
            style={controlStyle}
          >
            <option value="all">All roles</option>
            <option value="admin">Admin</option>
            <option value="super_admin">Super Admin</option>
            <option value="org_owner">Org Owner</option>
          </select>
        </div>
      )}

      <div className="project-card project-card-static" style={{ marginBottom: 24 }}>
        {!inviteOpen ? (
          <button
            onClick={() => setInviteOpen(true)}
            className="dt-brand"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              border: "none",
              cursor: "pointer",
              borderRadius: designTokens.radius.control,
              padding: "10px 16px",
              fontSize: designTokens.type.body.size,
              fontWeight: 600,
              lineHeight: 1,
            }}
          >
            <UserPlus style={{ width: 16, height: 16 }} /> Invite Associate
          </button>
        ) : (
          <div>
            <h2 className="dt-text-primary" style={{ ...cardTitleStyle, marginBottom: 12 }}>Invite a new associate</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder="Full name"
                className="dt-search dt-text-primary"
                style={controlStyle}
              />
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="Email address"
                className="dt-search dt-text-primary"
                style={controlStyle}
              />
            </div>
            <div className="flex items-center gap-3 mt-3">
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as "admin" | "super_admin")}
                className="dt-search dt-text-primary"
                style={controlStyle}
              >
                <option value="admin">Associate (Admin)</option>
                <option value="super_admin">Super Admin</option>
              </select>
              <button
                onClick={handleInvite}
                disabled={inviteSending || !inviteName.trim() || !inviteEmail.trim()}
                className="dt-brand"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  border: "none",
                  cursor: "pointer",
                  borderRadius: designTokens.radius.control,
                  padding: "10px 16px",
                  fontSize: designTokens.type.body.size,
                  fontWeight: 600,
                  lineHeight: 1,
                  opacity: inviteSending || !inviteName.trim() || !inviteEmail.trim() ? 0.5 : 1,
                }}
              >
                {inviteSending ? "Inviting..." : "Send Invite"}
              </button>
              <button
                onClick={() => setInviteOpen(false)}
                className="dt-text-secondary"
                style={{
                  fontSize: designTokens.type.body.size,
                  fontWeight: 500,
                  padding: "10px 12px",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="project-card project-card-static" style={{ overflowX: "auto" }}>
        {filteredMembers.length === 0 ? (
          membersList.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No team members yet"
              description="Invite your first associate to get started."
            />
          ) : (
            <EmptyState
              icon={UserSearch}
              title="No team members match your search"
              description="Try a different name, email, or role filter."
            />
          )
        ) : (
          <table className="w-full min-w-max text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--dt-card-border)" }}>
                {["Name", "Email", "Role", "Account", "Projects", "Certifications"].map((h) => (
                  <th key={h} className="dt-text-muted" style={thStyle}>{h}</th>
                ))}
                <th className="dt-text-muted" style={{ ...thStyle, textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredMembers.map((m) => {
                const isSelf = m.id === currentUserId;
                const isOrgOwner = m.role === "org_owner";
                const deactivated = !m.isActive;
                return (
                  <tr
                    key={m.id}
                    className={deactivated ? undefined : "dt-row"}
                    style={{
                      borderBottom: "1px solid var(--dt-card-border)",
                      transition: `background-color ${designTokens.motion.fast}`,
                      backgroundColor: deactivated ? "var(--dt-skeleton-bg)" : undefined,
                      opacity: deactivated ? 0.65 : undefined,
                    }}
                  >
                    <td style={tdStyle}>
                      <div className="flex items-center gap-2">
                        <Avatar name={m.name} seed={m.email} size="sm" />
                        <span
                          className={deactivated ? "dt-text-muted" : "dt-text-primary"}
                          style={{ fontWeight: 500, fontSize: designTokens.type.body.size, textDecoration: deactivated ? "line-through" : undefined }}
                        >
                          {m.name}
                        </span>
                        {deactivated && (
                          <span style={statusChip("archived")}>Deactivated</span>
                        )}
                      </div>
                    </td>
                    <td className="dt-text-secondary" style={tdStyle}>{m.email}</td>
                    <td style={tdStyle}>
                      <span style={roleChip(m.role)}>
                        <span style={roleDot(m.role)} />
                        {m.role}
                      </span>
                    </td>
                    <td className="dt-text-secondary" style={tdStyle}>{m.accountType ?? "â€”"}</td>
                    <td className="dt-text-secondary" style={{ ...tdStyle, fontSize: designTokens.type.caption.size }}>
                      {m.ownedProjectNames.length > 0 && (
                        <span style={{ display: "block" }}>Owns: {m.ownedProjectNames.join(", ")}</span>
                      )}
                      {m.assignedProjectNames.length > 0 && (
                        <span style={{ display: "block" }}>Assigned: {m.assignedProjectNames.join(", ")}</span>
                      )}
                      {m.ownedProjectNames.length === 0 && m.assignedProjectNames.length === 0 && "â€”"}
                    </td>
                    <td style={tdStyle}>
                      <AdminCertificationsEditor
                        adminId={m.id}
                        catalog={certifications}
                        selected={certificationsByAdmin[m.id] ?? []}
                      />
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      {isOrgOwner ? (
                        <span className="dt-promote-text" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: designTokens.type.caption.size, fontWeight: 600 }}>
                          <Shield style={{ width: 12, height: 12 }} /> Current Org Owner
                        </span>
                      ) : isSelf ? (
                        <span className="dt-text-muted" style={{ fontSize: designTokens.type.caption.size }}>You</span>
                      ) : deactivated ? (
                        canManage && (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleReactivate(m)}
                              disabled={saving === m.id}
                              className="dt-ok-text"
                              style={actionBtnStyle}
                            >
                              <RotateCcw style={{ width: 12, height: 12 }} /> Reactivate
                            </button>
                            {saving === m.id && <span className="dt-text-muted" style={{ fontSize: designTokens.type.caption.size }}>Saving...</span>}
                          </div>
                        )
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          <select
                            value={m.role}
                            onChange={(e) => handleRoleChange(m.id, e.target.value as "admin" | "super_admin")}
                            disabled={saving === m.id}
                            aria-label="Change role"
                            className="dt-search dt-text-primary"
                            style={{ ...controlStyle, padding: "4px 8px", fontSize: designTokens.type.caption.size }}
                          >
                            {ROLE_OPTIONS.map((r) => (
                              <option key={r} value={r}>{r}</option>
                            ))}
                          </select>
                          {saving === m.id && <span className="dt-text-muted" style={{ fontSize: designTokens.type.caption.size }}>Saving...</span>}
                          {currentUserRole === "org_owner" && (
                            <button
                              onClick={() => {
                                setPromoteTarget(m);
                                setConfirmPhrase("");
                              }}
                              className="dt-promote-text"
                              style={actionBtnStyle}
                            >
                              <Shield style={{ width: 12, height: 12 }} /> Promote
                            </button>
                          )}
                          {canManage && (
                            <button
                              onClick={() => setDeactivateTarget(m)}
                              className="dt-danger-text"
                              style={actionBtnStyle}
                            >
                              <UserX style={{ width: 12, height: 12 }} /> Deactivate
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {promoteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="project-card project-card-static" style={{ width: "100%", maxWidth: 480, margin: "0 16px", padding: 24 }}>
            <h2 className="dt-text-primary" style={{ ...modalTitleStyle, marginBottom: 8 }}>Transfer Org Ownership</h2>
            <p className="dt-text-secondary" style={{ fontSize: designTokens.type.body.size, marginBottom: 16 }}>
              This will transfer Org Owner status to <strong>{promoteTarget.name}</strong> ({promoteTarget.email}) and demote you to <strong>Super Admin</strong>. You will no longer be Org Owner.
            </p>
            <div
              className="dt-chip"
              style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: 12, borderRadius: designTokens.radius.control, marginBottom: 16 }}
            >
              <AlertTriangle style={{ width: 16, height: 16, color: designTokens.color.danger.base, flexShrink: 0, marginTop: 1 }} />
              <p className="dt-text-secondary" style={{ fontSize: designTokens.type.caption.size }}>
                This is a significant, irreversible action for your account. Only the new org owner can transfer it back.
              </p>
            </div>
            <p className="dt-text-secondary" style={{ fontSize: designTokens.type.caption.size, marginBottom: 8 }}>
              Type <strong>{promoteTarget.email}</strong> to confirm:
            </p>
            <input
              type="text"
              value={confirmPhrase}
              onChange={(e) => setConfirmPhrase(e.target.value)}
              placeholder="Type the user's email to confirm"
              className="dt-search dt-text-primary"
              style={{ width: "100%", padding: "10px 12px", fontSize: designTokens.type.body.size, borderRadius: designTokens.radius.control, marginBottom: 16 }}
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setPromoteTarget(null);
                  setConfirmPhrase("");
                }}
                className="dt-text-secondary"
                style={{ fontSize: designTokens.type.body.size, fontWeight: 500, background: "none", border: "none", cursor: "pointer", padding: "10px 16px" }}
              >
                Cancel
              </button>
              <button
                onClick={handlePromote}
                disabled={promoting || confirmPhrase !== promoteTarget.email}
                className="dt-btn-danger"
                style={{
                  fontSize: designTokens.type.body.size,
                  fontWeight: 600,
                  lineHeight: 1,
                  borderRadius: designTokens.radius.control,
                  padding: "10px 16px",
                  border: "none",
                  cursor: "pointer",
                  opacity: promoting || confirmPhrase !== promoteTarget.email ? 0.5 : 1,
                }}
              >
                {promoting ? "Transferring..." : "Confirm Transfer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deactivateTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="project-card project-card-static" style={{ width: "100%", maxWidth: 480, margin: "0 16px", padding: 24 }}>
            <h2 className="dt-text-primary" style={{ ...modalTitleStyle, marginBottom: 8 }}>Deactivate {deactivateTarget.name}</h2>
            <p className="dt-text-secondary" style={{ fontSize: designTokens.type.body.size, marginBottom: 12 }}>
              Deactivating <strong>{deactivateTarget.name}</strong> ({deactivateTarget.email}) will:
            </p>
            <ul className="dt-text-secondary" style={{ fontSize: designTokens.type.caption.size, marginBottom: 16, listStyle: "disc", paddingLeft: 18 }}>
              <li style={{ marginBottom: 6 }}>Remove them from all project assignments and off-board their future bookings.</li>
              <li style={{ marginBottom: 6 }}>Block them from signing in until reactivated.</li>
              <li style={{ marginBottom: 6 }}>Keep their booking history, audits, and certifications intact.</li>
              <li>Reactivating later does not restore their old project assignments.</li>
            </ul>
            <div
              className="dt-chip"
              style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: 12, borderRadius: designTokens.radius.control, marginBottom: 16 }}
            >
              <AlertTriangle style={{ width: 16, height: 16, color: designTokens.color.status.paused.dot, flexShrink: 0, marginTop: 1 }} />
              <p className="dt-text-secondary" style={{ fontSize: designTokens.type.caption.size }}>
                This is reversible via Reactivate, but their future bookings will be re-assigned to other available associates.
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeactivateTarget(null)}
                disabled={deactivating}
                className="dt-text-secondary"
                style={{ fontSize: designTokens.type.body.size, fontWeight: 500, background: "none", border: "none", cursor: "pointer", padding: "10px 16px", opacity: deactivating ? 0.5 : 1 }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeactivate}
                disabled={deactivating}
                className="dt-btn-danger"
                style={{
                  fontSize: designTokens.type.body.size,
                  fontWeight: 600,
                  lineHeight: 1,
                  borderRadius: designTokens.radius.control,
                  padding: "10px 16px",
                  border: "none",
                  cursor: "pointer",
                  opacity: deactivating ? 0.5 : 1,
                }}
              >
                {deactivating ? "Deactivating..." : "Confirm Deactivate"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
