"use client";

import { useEffect, useRef } from "react";
import { splitSegments, tokenLabel, type TextSegment } from "@/lib/blocks";

// ---------------------------------------------------------------------------
// Module-level "active token target" registry.
//
// The token toolbar in the surrounding editor needs to know which TokenEditor
// the user is currently typing in, so that inserting a token goes to the
// caret of THAT field. Each TokenEditor registers itself on mount and sets
// itself as the active target whenever it gains focus/click. The toolbar calls
// insertIntoActiveTarget(key).
// ---------------------------------------------------------------------------

type TokenEditorHandle = {
  id: string;
  insert(key: string): void;
};

let handles = new Map<string, TokenEditorHandle>();
let activeTargetId: string | null = null;
// Last-known caret offset (in serialized chars) per editor. The live
// window.getSelection() is destroyed the moment the user clicks the toolbar or
// the more-tokens menu autofocuses its search box, so each field remembers its
// caret position (captured while it had focus) and inserts use that as fallback.
let carets = new Map<string, number>();

function registerHandle(h: TokenEditorHandle) {
  handles.set(h.id, h);
}
function unregisterHandle(id: string) {
  handles.delete(id);
}

export function insertIntoActiveTarget(key: string) {
  const target = activeTargetId ? handles.get(activeTargetId) : null;
  if (target) {
    target.insert(key);
  } else {
    // fallback: insert into the most recently registered editor
    const last = Array.from(handles.values()).pop();
    last?.insert(key);
  }
}

export function focusTokenEditor(id: string) {
  activeTargetId = id;
}

// ---------------------------------------------------------------------------

let uid = 0;

export default function TokenEditor({
  value,
  onChange,
  placeholder,
  className,
  singleLine,
  onFocus,
  onBlur,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  className?: string;
  singleLine?: boolean;
  onFocus?: () => void;
  onBlur?: (relatedTarget: Node | null) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const idRef = useRef<string | null>(null);
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  valueRef.current = value;

  if (!idRef.current) idRef.current = `te_${Date.now().toString(36)}_${uid++}`.replace(/[^a-z0-9]/g, "");
  const id = idRef.current;

  useEffect(() => {
    registerHandle({ id, insert: insertAtCaret });
    return () => unregisterHandle(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Keep the DOM in sync with external `value` changes (e.g. token insertion),
  // without clobbering the caret mid-typing.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (serialize(el) === value) return;
    render(el, value);
  }, [value]);

  function insertAtCaret(key: string) {
    const el = ref.current;
    if (!el || !idRef.current) return;
    const text = serialize(el);
    const segs = splitSegments(text);
    // Prefer the live selection; fall back to the saved caret (the live one is
    // gone once focus moved to the toolbar/menu), else append.
    let offset = selectionOffset(el);
    if (offset == null) offset = carets.get(idRef.current) ?? text.length;
    // Find the segment containing the caret offset and insert there, splitting
    // a text segment at the caret. (Offsets use segment `value` lengths, which
    // match the DOM-text offsets computed by selectionOffset.)
    let i = segs.length;
    let acc = 0;
    for (let k = 0; k < segs.length; k++) {
      if (offset < acc + segs[k].value.length) {
        i = k;
        break;
      }
      acc += segs[k].value.length;
    }
    const inner = offset - acc; // chars into segment i
    if (i < segs.length && inner > 0 && segs[i].kind === "text") {
      const before = segs[i].value.slice(0, inner);
      const after = segs[i].value.slice(inner);
      segs.splice(i, 1, { kind: "text", value: before }, { kind: "token", value: key } satisfies TextSegment, { kind: "text", value: after });
    } else {
      segs.splice(i, 0, { kind: "token", value: key } satisfies TextSegment);
    }
    const next = segsToText(segs);
    render(el, next);
    onChangeRef.current(serialize(el));
    // Keep the saved caret just after the freshly inserted chip so consecutive
    // insertions stack in the same spot. (Segments use key-length values; the
    // caret bookkeeping uses the same metric, so stacking stays consistent.)
    carets.set(idRef.current, acc + inner + key.length);
    el.focus();
  }

  function captureCaret() {
    const el = ref.current;
    if (!el || !idRef.current) return;
    const off = selectionOffset(el);
    if (off != null) carets.set(idRef.current, off);
  }

  function handleFocus() {
    if (idRef.current) focusTokenEditor(idRef.current);
    captureCaret();
    onFocus?.();
  }

  function handleBlur(e: React.FocusEvent<HTMLElement>) {
    // Capture the caret while the live selection still belongs to this field —
    // Chrome keeps it here until focus/selection moves away.
    captureCaret();
    // e.relatedTarget (not document.activeElement, which is stale during the
    // blur dispatch) is the element about to receive focus — needed so the
    // toolbar keeps "armed" when the user clicks a toolbar/menu button.
    onBlur?.((e.relatedTarget as Node) ?? null);
  }

  function handleInput() {
    const el = ref.current;
    if (!el) return;
    onChangeRef.current(serialize(el));
  }

  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      onInput={handleInput}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onMouseUp={handleFocus}
      onClick={handleFocus}
      onKeyUp={captureCaret}
      spellCheck={false}
      data-placeholder={placeholder}
      className={`${className ?? ""} ${singleLine ? "whitespace-nowrap" : ""} min-h-[2.5rem]`}
      style={{ outline: "none" }}
    />
  );
}

function render(el: HTMLDivElement, text: string) {
  const segs = splitSegments(text);
  el.innerHTML = "";
  for (const seg of segs) {
    if (seg.kind === "token") appendChip(el, seg.value);
    else el.appendChild(document.createTextNode(seg.value));
  }
}

function appendChip(el: HTMLDivElement, key: string) {
  const span = document.createElement("span");
  span.contentEditable = "false";
  span.setAttribute("data-token", key);
  span.className =
    "inline-flex items-center align-middle mx-0.5 rounded bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-200 text-xs font-medium px-1.5 py-0.5 cursor-pointer select-none border border-indigo-200 dark:border-indigo-700";
  span.textContent = `{${tokenLabel(key)}}`;
  span.title = `${tokenLabel(key)} — click to remove`;
  span.addEventListener("click", () => {
    span.remove();
    dispatchInput(el);
  });
  span.addEventListener("keydown", (ev) => {
    if (ev.key === "Backspace" || ev.key === "Delete") {
      ev.preventDefault();
      span.remove();
      dispatchInput(el);
    }
  });
  el.appendChild(span);
}

function serialize(el: HTMLElement): string {
  let out = "";
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) out += node.textContent ?? "";
    else if (node instanceof HTMLElement && node.dataset.token) out += `{{${node.dataset.token}}}`;
  }
  return out;
}

function selectionOffset(el: HTMLElement): number | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const anchor = sel.anchorNode as Node | null;
  if (!anchor || !el.contains(anchor)) return null;
  const range = sel.getRangeAt(0).cloneRange();
  const before = document.createRange();
  before.selectNodeContents(el);
  before.setEnd(range.startContainer, range.startOffset);
  return before.toString().length;
}

function segsToText(segs: TextSegment[]): string {
  return segs.map((s) => (s.kind === "token" ? `{{${s.value}}}` : s.value)).join("");
}

function dispatchInput(el: HTMLElement) {
  el.dispatchEvent(new Event("input", { bubbles: true }));
}
