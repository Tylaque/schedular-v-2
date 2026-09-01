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
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  className?: string;
  singleLine?: boolean;
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
    if (!el) return;
    render(el, insertSegmentIntoString(el, key));
    onChangeRef.current(serialize(el));
    el.focus();
  }

  function handleFocus() {
    if (idRef.current) focusTokenEditor(idRef.current);
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
      onMouseUp={handleFocus}
      onClick={handleFocus}
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

function insertSegmentIntoString(el: HTMLDivElement, key: string): string {
  const text = serialize(el);
  const segs = splitSegments(text);
  const sel = window.getSelection();
  const anchor = sel?.anchorNode as Node | null;
  let insertIndex = segs.length;
  if (el.contains(anchor) && sel && sel.rangeCount > 0) {
    const range = sel.getRangeAt(0).cloneRange();
    const before = document.createRange();
    before.selectNodeContents(el);
    before.setEnd(range.startContainer, range.startOffset);
    const offsetChars = before.toString().length;
    let acc = 0;
    for (let i = 0; i < segs.length; i++) {
      acc += segs[i].value.length;
      if (offsetChars < acc) {
        insertIndex = i;
        break;
      }
    }
  }
  segs.splice(insertIndex, 0, { kind: "token", value: key } satisfies TextSegment);
  return segsToText(segs);
}

function segsToText(segs: TextSegment[]): string {
  return segs.map((s) => (s.kind === "token" ? `{{${s.value}}}` : s.value)).join("");
}

function dispatchInput(el: HTMLElement) {
  el.dispatchEvent(new Event("input", { bubbles: true }));
}
