"use client";

import { useRef, useState } from "react";
import {
  genId,
  tokenLabel,
  type Block,
  type SpacingOption,
} from "@/lib/blocks";
import { PLACEHOLDER_TOKENS } from "@/lib/template-utils";
import TokenEditor, { insertIntoActiveTarget } from "./TokenEditor";

const SPACING_OPTIONS: { key: SpacingOption; label: string }[] = [
  { key: "normal", label: "Normal" },
  { key: "tight", label: "Tight" },
  { key: "none", label: "None" },
];

const BLOCK_TYPE_OPTIONS: { type: Block["type"]; label: string }[] = [
  { type: "heading", label: "Heading" },
  { type: "paragraph", label: "Paragraph" },
  { type: "button", label: "Button" },
  { type: "textlink", label: "Text link" },
  { type: "card", label: "Details card" },
  { type: "pinbox", label: "PIN box" },
  { type: "footer", label: "Footer" },
  { type: "divider", label: "Divider" },
];

// A handful of the most-used tokens, shown directly in the top toolbar. The
// full list is still reachable via the "More tokens…" dropdown.
const CATEGORY_COMMON_TOKENS: Record<string, string[]> = {
  admin_invitation: ["project_name", "company_name", "admin_name"],
  availability_request: ["participant_name", "project_name", "admin_name", "booking_link"],
  participant_invitation: ["participant_name", "project_name", "company_name", "booking_link"],
  booking_confirmation: ["admin_name", "project_name", "session_date", "session_time", "participant_name", "manage_booking_link"],
  reminder_24h: ["participant_name", "project_name", "session_date", "session_time", "manage_booking_link"],
  reminder_1h: ["participant_name", "project_name", "session_date", "session_time", "manage_booking_link"],
  reminder: ["participant_name", "project_name", "session_date", "session_time", "manage_booking_link"],
  reschedule_notice: ["participant_name", "project_name", "session_date", "session_time", "manage_booking_link"],
  cancellation_notice: ["participant_name", "project_name", "session_date"],
  waitlist_offer: ["participant_name", "project_name", "company_name", "booking_link"],
  zoom_fallback_to_teams: ["admin_name", "project_name", "session_date", "session_time", "participant_name", "meeting_platform_label"],
  zoom_pool_full_no_fallback: ["admin_name", "project_name", "session_date", "session_time", "participant_name"],
};
const DEFAULT_COMMON_TOKENS = ["participant_name", "admin_name", "project_name", "session_date", "session_time", "company_name"];

export default function BlockEditor({
  blocks,
  onChange,
  category,
}: {
  blocks: Block[];
  onChange: (blocks: Block[]) => void;
  category?: string;
}) {
  // "armed" = a text field has focus, or focus is currently inside the editor's
  // own toolbar/menus after a field was focused. The top token toolbar needs a
  // focused field to insert into, so it stays enabled while the user is
  // "armed" and interacting with the toolbar, and only disables once focus
  // actually leaves the whole editor.
  const rootRef = useRef<HTMLDivElement>(null);
  const [armed, setArmed] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const commonTokens = CATEGORY_COMMON_TOKENS[category ?? ""] ?? DEFAULT_COMMON_TOKENS;

  function updateBlock(id: string, patch: Partial<Block>) {
    onChange(blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }
  function removeBlock(id: string) {
    onChange(blocks.filter((b) => b.id !== id));
  }
  function moveBlock(id: string, dir: -1 | 1) {
    const idx = blocks.findIndex((b) => b.id === id);
    const to = idx + dir;
    if (idx < 0 || to < 0 || to >= blocks.length) return;
    const next = [...blocks];
    [next[idx], next[to]] = [next[to], next[idx]];
    onChange(next);
  }
  function addBlock(type: Block["type"]) {
    let block: Block = { id: genId(), type };
    if (type === "paragraph") block.spacing = "none";
    if (type === "button") block.label = "Button";
    if (type === "textlink") block.label = "Text link";
    if (type === "heading") block.text = "Heading";
    if (type === "footer") block.text = "Best,<br/>{{company_name}}";
    if (type === "card") block.rows = [];
    if (type === "pinbox") block.text = "{{pin}}";
    onChange([...blocks, block]);
  }

  function onInsert(key: string) {
    insertIntoActiveTarget(key);
    setMoreOpen(false);
  }

  const editorFocusProps = {
    onFocus: () => setArmed(true),
    onBlur: (related: Node | null) => {
      // Keep the toolbar "armed" if focus just moved somewhere inside this
      // editor (e.g. a toolbar button or the more-tokens menu), so inserting
      // still targets the last-focused field. Clear it only when leaving the
      // editor entirely.
      if (rootRef.current && !rootRef.current.contains(related)) setArmed(false);
    },
  };

  return (
    <div ref={rootRef} className="space-y-4">
      <InsertToolbar
        common={commonTokens}
        armed={armed}
        moreOpen={moreOpen}
        onToggleMore={() => setMoreOpen((o) => !o)}
        onInsert={onInsert}
      />

      {blocks.map((b, i) => (
        <div key={b.id} className="group border border-gray-200 rounded-lg bg-white dark:border-gray-700 dark:bg-gray-900">
          <div className="flex items-center justify-end px-3 pt-2">
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150">
              <button type="button" disabled={i === 0} onClick={() => moveBlock(b.id, -1)}
                className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30 dark:hover:text-gray-200 dark:hover:bg-gray-800" title="Move up" aria-label="Move up">↑</button>
              <button type="button" disabled={i === blocks.length - 1} onClick={() => moveBlock(b.id, 1)}
                className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30 dark:hover:text-gray-200 dark:hover:bg-gray-800" title="Move down" aria-label="Move down">↓</button>
              <button type="button" onClick={() => removeBlock(b.id)}
                className="p-1 rounded text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30" title="Remove block" aria-label="Remove block">✕</button>
            </div>
          </div>
          <div className="px-3 pb-3">
            <BlockBody block={b} onChange={(patch) => updateBlock(b.id, patch)} {...editorFocusProps} />
          </div>
        </div>
      ))}

      <AddBlockRow onAdd={addBlock} />
    </div>
  );
}

function InsertToolbar({
  common,
  armed,
  moreOpen,
  onToggleMore,
  onInsert,
}: {
  common: string[];
  armed: boolean;
  moreOpen: boolean;
  onToggleMore: () => void;
  onInsert: (key: string) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 dark:border-gray-700 dark:bg-gray-900">
      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 mr-1">Insert token:</span>
      {common.map((t) => (
        <button
          key={t}
          type="button"
          disabled={!armed}
          onClick={() => onInsert(t)}
          title={`Insert ${tokenLabel(t)} — {{${t}}}`}
          className={`px-2 py-1 rounded border text-[11px] font-medium dark:border-gray-600 ${
            armed
              ? "border-gray-300 text-gray-700 hover:bg-brand-500 hover:text-white dark:text-gray-200 dark:hover:bg-brand-600"
              : "border-gray-200 text-gray-300 cursor-not-allowed dark:border-gray-800 dark:text-gray-600"
          }`}
        >
          {tokenLabel(t)}
        </button>
      ))}
      <div className="relative">
        <button
          type="button"
          disabled={!armed}
          onClick={onToggleMore}
          title="More tokens"
          className={`px-2 py-1 rounded border text-[11px] font-medium dark:border-gray-600 ${
            armed
              ? "border-gray-300 text-gray-700 hover:bg-gray-200 dark:text-gray-200 dark:hover:bg-gray-800"
              : "border-gray-200 text-gray-300 cursor-not-allowed dark:border-gray-800 dark:text-gray-600"
          }`}
        >
          More tokens… ▾
        </button>
        {moreOpen && (
          <div className="absolute z-30 mt-1 left-0 w-64 max-h-72 overflow-y-auto border border-gray-200 rounded-lg bg-white shadow-lg p-1 dark:border-gray-700 dark:bg-gray-900">
            <TokenMenu onPick={onInsert} />
          </div>
        )}
      </div>
      {!armed && (
        <span className="text-[11px] text-gray-400 dark:text-gray-500 ml-1">
          Click a line, then insert.
        </span>
      )}
    </div>
  );
}

function BlockBody({
  block,
  onChange,
  onFocus,
  onBlur,
}: {
  block: Block;
  onChange: (patch: Partial<Block>) => void;
  onFocus: () => void;
  onBlur: (related: Node | null) => void;
}) {
  switch (block.type) {
    case "heading":
      return (
        <label className="block text-sm">
          <span className="text-xs text-gray-500 dark:text-gray-400 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150">Heading text</span>
          <TokenEditor value={block.text ?? ""} onChange={(v) => onChange({ text: v })} placeholder="Heading"
            onFocus={onFocus} onBlur={onBlur}
            className="w-full mt-1 rounded-lg border border-gray-300 px-3 py-2 text-base font-semibold dark:border-gray-600" />
        </label>
      );
    case "paragraph": {
      const spacing = SPACING_OPTIONS.find((s) => s.key === (block.spacing ?? "none")) ?? SPACING_OPTIONS[2];
      return (
        <div>
          <span className="text-xs text-gray-500 dark:text-gray-400 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150">Paragraph text</span>
          <TokenEditor value={block.text ?? ""} onChange={(v) => onChange({ text: v })} placeholder="Paragraph"
            onFocus={onFocus} onBlur={onBlur}
            className="w-full mt-1 rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600" />
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-gray-500 dark:text-gray-400 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150">Spacing:</span>
            <select
              value={spacing.key}
              onChange={(e) => onChange({ spacing: e.target.value as SpacingOption })}
              className="text-xs border border-gray-300 rounded px-2 py-1 bg-white text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
            >
              {SPACING_OPTIONS.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>
      );
    }
    case "button":
    case "textlink":
      return (
        <div className="space-y-2">
          <label className="block text-sm">
            <span className="text-xs text-gray-500 dark:text-gray-400 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150">Label</span>
            <TokenEditor value={block.label ?? ""} onChange={(v) => onChange({ label: v })} placeholder="Label"
              onFocus={onFocus} onBlur={onBlur}
              className="w-full mt-1 rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600" />
          </label>
          <label className="block text-sm">
            <span className="text-xs text-gray-500 dark:text-gray-400 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150">Link / token</span>
            <input value={block.href ?? ""} onChange={(e) => onChange({ href: e.target.value })}
              placeholder="{{booking_link}}" className="w-full mt-1 text-sm border border-gray-300 rounded-lg px-3 py-2 dark:border-gray-600" />
          </label>
        </div>
      );
    case "card":
      return <CardEditor block={block} onChange={onChange} onFocus={onFocus} onBlur={onBlur} />;
    case "pinbox":
      return (
        <label className="block text-sm">
          <span className="text-xs text-gray-500 dark:text-gray-400 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150">PIN content</span>
          <TokenEditor value={block.text ?? ""} onChange={(v) => onChange({ text: v })} placeholder="{{pin}}"
            onFocus={onFocus} onBlur={onBlur}
            className="w-full mt-1 rounded-lg border border-gray-300 px-3 py-2 text-center text-2xl font-bold tracking-widest dark:border-gray-600" />
        </label>
      );
    case "footer":
      return (
        <label className="block text-sm">
          <span className="text-xs text-gray-500 dark:text-gray-400 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150">Footer text</span>
          <TokenEditor value={block.text ?? ""} onChange={(v) => onChange({ text: v })} placeholder="Best,<br/>{{company_name}}"
            onFocus={onFocus} onBlur={onBlur}
            className="w-full mt-1 rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600" />
        </label>
      );
    case "divider":
      return (
        <div className="text-xs text-gray-400 dark:text-gray-500 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150">
          Horizontal divider — no settings needed.
        </div>
      );
    default:
      return null;
  }
}

function CardEditor({
  block,
  onChange,
  onFocus,
  onBlur,
}: {
  block: Block;
  onChange: (patch: Partial<Block>) => void;
  onFocus: () => void;
  onBlur: (related: Node | null) => void;
}) {
  const rows = block.rows ?? [];
  const interviewer = rows.find((r) => r.type === "interviewer");
  const meeting = rows.find((r) => r.type === "meeting");
  const zoom = rows.find((r) => r.type === "zoom");
  const title = rows.find((r) => r.type === "title");
  const details = rows.filter((r) => r.type === "detail");

  function upsertRow(updated: typeof rows[number]) {
    // Conditional rows (interviewer/meeting/zoom) are singletons keyed by type.
    const exists = rows.some((r) => r.type === updated.type && (r.type !== "meeting" || true));
    if (exists) {
      onChange({ rows: rows.map((r) => (r.type === updated.type ? updated : r)) });
    } else {
      onChange({ rows: [...rows, updated] });
    }
  }
  function setTitleText(v: string) {
    if (title) onChange({ rows: rows.map((r) => (r.type === "title" ? { ...r, text: v } : r)) });
    else onChange({ rows: [...rows, { type: "title" as const, text: v }] });
  }
  function setDetail(idx: number, v: string) {
    onChange({ rows: rows.map((r, i) => (i === idx ? { ...r, text: v } : r)) });
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border-2 border-dashed border-indigo-200 bg-indigo-50/50 p-3 dark:border-indigo-800 dark:bg-indigo-950/30">
        <div className="text-xs font-semibold text-indigo-600 dark:text-indigo-300 mb-2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150">Details card</div>

        {/* Title */}
        <div className="mb-2">
          <div className="text-xs text-gray-500 dark:text-gray-400 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150">Title (bold)</div>
          <TokenEditor value={title?.text ?? ""} onChange={setTitleText} placeholder="Project name"
            onFocus={onFocus} onBlur={onBlur}
            className="w-full mt-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold dark:border-gray-600" />
        </div>

        {/* Detail rows */}
        {details.map((d, i) => {
          const rowsIdx = rows.findIndex((r) => r === d);
          return (
            <div key={i} className="mb-1.5 flex items-center gap-1.5">
              <TokenEditor value={d.text ?? ""} onChange={(v) => setDetail(rowsIdx, v)} placeholder="Detail row"
                onFocus={onFocus} onBlur={onBlur}
                className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-600" />
            </div>
          );
        })}

        {/* Conditional rows as checkboxes/selects */}
        <div className="mt-2 space-y-2 border-t border-indigo-100 dark:border-indigo-900 pt-2">
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
            <input type="checkbox" checked={interviewer?.enabled !== false}
              onChange={(e) => upsertRow({ type: "interviewer", enabled: e.target.checked })} />
            Show interviewer line
          </label>
          <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
            <span className="w-40 shrink-0 text-xs text-gray-500 dark:text-gray-400 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150">Meeting link:</span>
            <select
              value={meeting?.meetingMode ?? "auto"}
              onChange={(e) => upsertRow({ type: "meeting", meetingMode: e.target.value as any })}
              className="text-xs border border-gray-300 rounded px-2 py-1 bg-white text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
            >
              <option value="auto">Auto (join or pending)</option>
              <option value="join">Show join link</option>
              <option value="pending">Show pending message</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
            <input type="checkbox" checked={zoom?.enabled !== false}
              onChange={(e) => upsertRow({ type: "zoom", enabled: e.target.checked })} />
            Show which Zoom account was used
          </label>
        </div>
      </div>

      {rows.length === 0 && (
        <p className="text-xs text-gray-400 dark:text-gray-500 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150">
          This card is empty — add a title or detail rows by switching this block to a paragraph, or handle it in Advanced mode.
        </p>
      )}
    </div>
  );
}

function AddBlockRow({ onAdd }: { onAdd: (type: Block["type"]) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button"
        onClick={() => setOpen(!open)}
        className="border border-dashed border-gray-300 text-gray-600 hover:border-brand-500 hover:text-brand-600 rounded-lg px-4 py-2 text-sm font-medium dark:border-gray-600 dark:text-gray-300">
        + Add block
      </button>
      {open && (
        <div className="flex flex-wrap gap-1.5">
          {BLOCK_TYPE_OPTIONS.map((o) => (
            <button key={o.type} type="button" onClick={() => { onAdd(o.type); setOpen(false); }}
              className="border border-gray-300 rounded px-2.5 py-1.5 text-xs text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800">
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function TokenMenu({ onPick }: { onPick: (key: string) => void }) {
  const [filter, setFilter] = useState("");
  const tokens = PLACEHOLDER_TOKENS.filter((t) => tokenLabel(t).toLowerCase().includes(filter.toLowerCase()));
  return (
    <div>
      <input autoFocus value={filter} onChange={(e) => setFilter(e.target.value)}
        placeholder="Search tokens…" className="w-full text-xs border border-gray-300 rounded px-2 py-1.5 mb-1 dark:border-gray-600 dark:bg-gray-800" />
      <div className="space-y-0.5">
        {tokens.map((t) => (
          <button key={t} type="button" onClick={() => onPick(t)}
            className="w-full text-left px-2 py-1.5 rounded text-xs text-gray-700 hover:bg-indigo-50 dark:text-gray-200 dark:hover:bg-indigo-900/40">
            <span className="font-medium">{tokenLabel(t)}</span>
            <span className="text-gray-400 ml-1">{"{{"}{t}{"}}"}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
