"use client";

import { useState } from "react";
import { BadgeCheck, ChevronDown, ChevronUp } from "lucide-react";
import { setAdminCertificationsAction } from "@/lib/actions";
import { designTokens } from "@/lib/design-tokens";

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
        className="dt-chip dt-text-secondary"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          borderRadius: designTokens.radius.control,
          padding: "4px 10px",
          fontSize: designTokens.type.caption.size,
          fontWeight: designTokens.type.caption.weight,
          lineHeight: 1,
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
        title="Manage certifications"
      >
        <BadgeCheck style={{ width: 14, height: 14, color: designTokens.color.brand[500] }} />
        Certifications ({current.length})
        {open ? <ChevronUp style={{ width: 12, height: 12 }} /> : <ChevronDown style={{ width: 12, height: 12 }} />}
      </button>

      {open && (
        <div className="project-card project-card-static" style={{ position: "absolute", zIndex: 40, top: "calc(100% + 8px)", right: 0, width: 288, maxWidth: "90vw", padding: 16 }}>
          <p className="dt-text-primary" style={{ fontSize: designTokens.type.caption.size, fontWeight: 600, marginBottom: 8 }}>Certifications</p>
          {selectedNames.length > 0 && (
            <p className="dt-text-secondary" style={{ fontSize: designTokens.type.caption.size, marginBottom: 8 }}>
              Currently: {selectedNames.join(", ")}
            </p>
          )}
          <div className="max-h-56 overflow-y-auto space-y-1.5 mb-3">
            {catalog.length === 0 && (
              <p className="dt-text-muted" style={{ fontSize: designTokens.type.caption.size }}>
                No certifications in the catalog yet.
              </p>
            )}
            {catalog.map((c) => (
              <label
                key={c.id}
                className="flex items-center gap-2 dt-text-primary"
                style={{ fontSize: designTokens.type.body.size, cursor: "pointer", borderRadius: designTokens.radius.control, padding: "4px 6px" }}
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
          {err && <p className="dt-danger-text" style={{ fontSize: designTokens.type.caption.size, marginBottom: 8 }}>{err}</p>}
          <div className="flex justify-end gap-2">
            <button
              onClick={cancel}
              className="dt-text-secondary"
              style={{ fontSize: designTokens.type.caption.size, fontWeight: 500, background: "none", border: "none", cursor: "pointer", padding: "6px 12px" }}
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="dt-brand"
              style={{
                fontSize: designTokens.type.caption.size,
                fontWeight: 600,
                lineHeight: 1,
                borderRadius: designTokens.radius.control,
                padding: "8px 12px",
                border: "none",
                cursor: "pointer",
                opacity: saving ? 0.5 : 1,
              }}
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
