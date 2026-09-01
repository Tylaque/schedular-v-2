// Structured block model for the email template editor (Simple mode).
//
// This module converts between raw bodyHtml (the existing stored format) and a
// structured block tree. It does NOT change how templates are stored, rendered,
// or sent — it only provides parse/serialize functions that the Simple-mode
// editor uses to edit the SAME bodyHtml string (still saved into the bodyHtml
// column via the existing createTemplateVersion path).
//
// Tokens ({participant_name}) are represented inside block text as literal
// {{key}} strings in the stored/serialized HTML, but in the editor UI they are
// rendered as removable chips. The parser keeps {{key}} as-is; no spans are
// ever written into bodyHtml.

import { PLACEHOLDER_TOKENS } from "@/lib/template-utils";

export type BlockType =
  | "heading"
  | "paragraph"
  | "button"
  | "textlink"
  | "card"
  | "pinbox"
  | "footer"
  | "divider";

export type SpacingOption = "normal" | "tight" | "none";
export type MeetingMode = "auto" | "join" | "pending";

export interface CardRow {
  type: "title" | "detail" | "interviewer" | "meeting" | "zoom";
  text?: string; // plain text content (tokens inline as {{key}})
  enabled?: boolean; // interviewer / zoom row visibility (default true)
  meetingMode?: MeetingMode; // meeting row 3-state
  pendingText?: string; // meeting pending-message text (varies by audience)
  margin?: string; // detail/title rows: original margin style (varies)
}

export interface Block {
  id: string;
  type: BlockType;
  text?: string; // heading/paragraph/footer text (with {{token}} inline)
  spacing?: SpacingOption; // paragraph spacing
  label?: string; // button/textlink label
  href?: string; // button/textlink href
  prefix?: string; // button/textlink: text rendered before the <a> (e.g. "Manage this booking: ")
  suffix?: string; // button/textlink: text rendered after the </a> (e.g. ".")
  rows?: CardRow[]; // card rows
}

let seq = 0;
export function genId(): string {
  seq += 1;
  return `blk_${Date.now().toString(36)}_${seq}`;
}

// ---------------------------------------------------------------------------
// Constants (byte-identical to existing markup)
// ---------------------------------------------------------------------------

export const STANDARD_WRAPPER =
  '<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">';

export const HEADING_STYLE = "margin:0;font-size:20px;font-weight:700;color:#111827;";
export const BUTTON_STYLE =
  "background:#4338CA;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;";
export const TEXT_LINK_STYLE = "color:#4338CA;";
export const CARD_STYLE =
  "border:2px dashed #DCE1FB;border-radius:12px;padding:20px;margin:20px 0;background:#EEF1FD;";
export const PIN_CARD_STYLE =
  "background:#EEF1FD;border:2px dashed #DCE1FB;border-radius:12px;padding:20px;margin:20px 0;text-align:center;";
export const PIN_STYLE = "margin:0;font-size:32px;font-weight:700;letter-spacing:8px;color:#4338CA;";
export const DIVIDER_STYLE = "margin:12px 0;border-top:1px solid #e5e7eb;";

export const PARAGRAPH_STYLES: { key: SpacingOption; label: string; style: string }[] = [
  { key: "normal", label: "Normal", style: "margin:0 0 16px;" },
  { key: "tight", label: "Tight", style: "margin:16px 0 0;" },
  { key: "none", label: "None", style: "" },
];

export const CARD_TITLE_STYLE = "margin:0 0 8px;";
export const CARD_DETAIL_STYLE = "margin:0 0 4px;";
export const CARD_INTERVIEWER_STYLE = "margin:0 0 4px;";
export const CARD_PENDING_STYLE = "margin:12px 0 0;color:#6b7280;";
export const CARD_JOIN_STYLE = "margin:12px 0 0;";
export const CARD_ZOOM_STYLE = "margin:8px 0 4px;";

// ---------------------------------------------------------------------------
// Parse: bodyHtml -> Block[]
// ---------------------------------------------------------------------------

export interface ParseResult {
  ok: boolean;
  blocks: Block[];
  error?: string;
}

const WRAPPER_RE = /^<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">([\s\S]*)<\/div>$/;

export function parseTemplateHtml(bodyHtml: string): ParseResult {
  const trimmed = bodyHtml.trim();
  const wm = trimmed.match(WRAPPER_RE);
  if (!wm) return { ok: false, blocks: [], error: "unsupported_layout" };

  const inner = wm[1];
  const blocks: Block[] = [];

  // Split the wrapper's direct children. Direct children are h1/p/div elements.
  const childRe = /<(h1|p|div)((?:[^>]*))>([\s\S]*?)<\/\1>/g;
  let rest = inner;
  // We iterate by finding the first child, slicing it out including leading whitespace.
  let pos = 0;
  const mRe = /<(h1|p|div)((?:[^>]*))>([\s\S]*?)<\/\1>/;
  while (rest.trim().length > 0) {
    // Skip leading whitespace
    const lead = rest.match(/^\s*/)![0];
    rest = rest.slice(lead.length);
    const m = rest.match(mRe);
    if (!m) return { ok: false, blocks: [], error: "unexpected_content" };
    const tag = m[1];
    const attrs = m[2];
    const text = m[3];
    const parsed = parseBlock(tag, attrs, text);
    if (!parsed) return { ok: false, blocks: [], error: "unknown_block" };
    blocks.push(parsed);
    rest = rest.slice(m[0].length);
    pos += lead.length + m[0].length;
  }

  return { ok: true, blocks };
}

function parseBlock(tag: string, attrs: string, text: string): Block | null {
  const cond = /style="([^"]*)"/.exec(attrs)?.[1] ?? "";
  if (tag === "h1") {
    return { id: genId(), type: "heading", text: normalize(text) };
  }
  if (tag === "div") {
    if (cond.includes("text-align:center") && text.includes('font-size:32px')) {
      // pin-box
      const pinText = /<p[^>]*>([\s\S]*?)<\/p>/.exec(text)?.[1] ?? "";
      return { id: genId(), type: "pinbox", text: normalize(pinText) };
    }
    if (cond.includes("border:2px dashed #DCE1FB")) {
      const rows = parseCardRows(text);
      if (!rows) return null;
      return { id: genId(), type: "card", rows };
    }
    return null;
  }
  // p
  if (/border-top:1px solid #e5e7eb/.test(cond) && text.trim() === "") {
    return { id: genId(), type: "divider" };
  }
  // button: <p><a style="background:#4338CA...
  const btnMatch = /^([\s\S]*?)<a\s+[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>([\s\S]*)$/.exec(text);
  if (btnMatch && text.includes("background:#4338CA")) {
    return {
      id: genId(), type: "button",
      label: normalize(btnMatch[3]),
      href: btnMatch[2],
      prefix: normalizeKeepEdges(btnMatch[1]),
      suffix: normalizeKeepEdges(btnMatch[4]),
    };
  }
  // textlink: <p><a style="color:#4338CA;
  const tlMatch = /^([\s\S]*?)<a\s+[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>([\s\S]*)$/.exec(text);
  if (tlMatch && /color:#4338CA/.test(text) && !/background:#4338CA/.test(text)) {
    return {
      id: genId(), type: "textlink",
      label: normalize(tlMatch[3]),
      href: tlMatch[2],
      prefix: normalizeKeepEdges(tlMatch[1]),
      suffix: normalizeKeepEdges(tlMatch[4]),
    };
  }
  const isPlain = !/style=/.test(attrs);
  // Small gray footer (e.g. admin footer) OR a sign-off ending in <br/>{{...}}
  if (/font-size:12px/.test(cond) || (isPlain && /<br\s*\/?>\s*(\{\{[a-z_0-9]+\}\}|[A-Za-z])$/.test(text.trim()))) {
    return { id: genId(), type: "footer", text: normalize(text) };
  }
  if (isPlain) {
    // Plain <p> (greeting / body paragraph) -> paragraph, no spacing override
    return { id: genId(), type: "paragraph", text: normalize(text), spacing: "none" };
  }
  // styled paragraph with spacing
  let spacing: SpacingOption = "none";
  if (/margin:0 0 16px/.test(cond)) spacing = "normal";
  else if (/margin:16px 0 0/.test(cond)) spacing = "tight";
  return { id: genId(), type: "paragraph", text: normalize(text), spacing };
}

// Parse the rows inside a details-card div.
function parseCardRows(inner: string): CardRow[] | null {
  const rows: CardRow[] = [];
  // Iterate top-level parts: unless-blocks OR plain <p> rows.
  const partRe =
    /\{\{#unless\s+(\w+)\}\}([\s\S]*?)\{\{\/unless\s+\1\}\}|<p((?:[^>]*))>([\s\S]*?)<\/p>/g;

  // For merging meeting conditionals we collect markers.
  let pendingIdx = -1;
  let joinIdx = -1;

  let m: RegExpExecArray | null;
  while ((m = partRe.exec(inner)) !== null) {
    if (m[1] !== undefined) {
      // unless-block
      const key = m[1];
      const content = m[2].trim();
      if (key === "is_feedback") {
        rows.push({ type: "interviewer", enabled: true });
      } else if (key === "has_meeting_link") {
        rows.push({ type: "meeting", meetingMode: "pending", pendingText: extractPendingText(content) });
        pendingIdx = rows.length - 1;
      } else if (key === "no_meeting_link") {
        rows.push({ type: "meeting", meetingMode: "join" });
        joinIdx = rows.length - 1;
      } else if (key === "no_zoom_account") {
        rows.push({ type: "zoom", enabled: true });
      } else {
        return null; // unknown conditional -> not cleanly parseable
      }
      } else {
        // plain <p> row
        const style = /style="([^"]*)"/.exec(m[0])?.[1] ?? "";
        const inner = m[4];
        if (/margin:0 0 8px/.test(style)) {
          // title row: strip a full <strong>…</strong> wrapper so the serializer
          // does not double-wrap.
          const clean = inner.trim().replace(/^<strong>([\s\S]*?)<\/strong>$/, "$1");
          rows.push({ type: "title", text: normalize(clean) });
        } else if (/margin:8px 0 4px/.test(style)) {
          rows.push({ type: "zoom", enabled: true, text: normalize(inner) });
        } else {
          rows.push({ type: "detail", text: normalize(inner), margin: extractMargin(style) });
        }
      }
  }

  // Merge meeting conditionals: if both pending and join present -> auto;
  // collapse into a single meeting row at the earlier index, preserving the
  // pending message wording where it came from.
  if (pendingIdx >= 0 && joinIdx >= 0) {
    const first = Math.min(pendingIdx, joinIdx);
    const second = Math.max(pendingIdx, joinIdx);
    rows[first] = { type: "meeting", meetingMode: "auto", pendingText: rows[first].pendingText ?? rows[second].pendingText };
    rows.splice(second, 1);
  } else if (pendingIdx >= 0) {
    rows[pendingIdx] = { type: "meeting", meetingMode: "pending" };
  } else if (joinIdx >= 0) {
    rows[joinIdx] = { type: "meeting", meetingMode: "join" };
  }

  return rows;
}

// Extract the display text of the "pending" message inside a {{#unless
// has_meeting_link}} block, so the serializer can reproduce the exact wording
// (it varies: "Your meeting link is pending…" vs "Meeting link is pending…").
function extractPendingText(content: string): string {
  const inner = /<p[^>]*>([\s\S]*?)<\/p>/.exec(content)?.[1] ?? "";
  return normalize(inner);
}

function extractMargin(style: string): string {
  return /(margin:[^;]+;?)/.exec(style)?.[1] ?? "margin:0 0 4px;";
}

function normalizeKeepEdges(s: string): string {
  // Collapse whitespace runs to single spaces but preserve leading/trailing
  // spaces — used for textlink/button prefix/suffix where boundary spacing
  // (e.g. " — reschedule") must be kept.
  return s
    .replace(/<br\s*\/?>/g, "\u0000BR\u0000")
    .replace(/\s+/g, " ")
    .replace(/\u0000BR\u0000/g, "<br/>");
}

function normalize(s: string): string {
  // Collapse whitespace/newline runs to single spaces (preserving tokens,
  // <br/> and <strong>), then trim the whole string. Single spaces adjacent to
  // tokens are preserved so we never merge e.g. "Hi {{name}}" into "Hi{{name}}".
  return s
    .replace(/<br\s*\/?>/g, "\u0000BR\u0000")
    .replace(/\s+/g, " ")
    .replace(/\u0000BR\u0000/g, "<br/>")
    .trim();
}

// ---------------------------------------------------------------------------
// Serialize: Block[] -> bodyHtml
// ---------------------------------------------------------------------------

export function serializeTemplateHtml(blocks: Block[]): string {
  const inner = blocks.map(serializeBlock).join("\n");
  return `${STANDARD_WRAPPER}\n${inner}\n</div>`;
}

function spacingToStyle(spacing?: SpacingOption): string {
  if (spacing === "normal") return "margin:0 0 16px;";
  if (spacing === "tight") return "margin:16px 0 0;";
  return "";
}function textToHtml(text: string): string {
  // Tokens stay literal; everything else is already HTML-ish (may include <br/>).
  return text;
}

function serializeBlock(b: Block): string {
  switch (b.type) {
    case "heading":
      return `<h1 style="${HEADING_STYLE}">${textToHtml(b.text ?? "")}</h1>`;
    case "paragraph": {
      const st = spacingToStyle(b.spacing);
      return `<p${st ? ` style="${st}"` : ""}>${textToHtml(b.text ?? "")}</p>`;
    }
    case "button":
      return `<p style="margin:24px 0;">${textToHtml(b.prefix ?? "")}<a href="${b.href ?? ""}" style="${BUTTON_STYLE}">${textToHtml(b.label ?? "")}</a>${textToHtml(b.suffix ?? "")}</p>`;
    case "textlink":
      return `<p style="margin:16px 0;">${textToHtml(b.prefix ?? "")}<a href="${b.href ?? ""}" style="${TEXT_LINK_STYLE}">${textToHtml(b.label ?? "")}</a>${textToHtml(b.suffix ?? "")}</p>`;
    case "card":
      return `<div style="${CARD_STYLE}">${serializeCardRows(b.rows ?? [])}</div>`;
    case "pinbox":
      return `<div style="${PIN_CARD_STYLE}"><p style="${PIN_STYLE}">${textToHtml(b.text ?? "")}</p></div>`;
    case "footer":
      return `<p>${textToHtml(b.text ?? "")}</p>`;
    case "divider":
      return `<p style="${DIVIDER_STYLE}"></p>`;
    default:
      return "";
  }
}

function serializeCardRows(rows: CardRow[]): string {
  const out: string[] = [];
  for (const row of rows) {
    switch (row.type) {
      case "title":
        out.push(`<p style="${row.margin ?? CARD_TITLE_STYLE}"><strong>${textToHtml(row.text ?? "")}</strong></p>`);
        break;
      case "detail":
        out.push(`<p style="${row.margin ?? CARD_DETAIL_STYLE}">${textToHtml(row.text ?? "")}</p>`);
        break;
      case "interviewer":
        if (row.enabled !== false) {
          out.push(
            `{{#unless is_feedback}}<p style="${CARD_INTERVIEWER_STYLE}">Interviewer: {{admin_name}}</p>\n{{/unless is_feedback}}`
          );
        }
        break;
      case "meeting":
        // Pending (has_meeting_link) renders first, then join, matching the
        // original booking_confirmation markup order.
        if (row.meetingMode === "pending" || row.meetingMode === "auto") {
          const pendingText =
            row.pendingText && row.pendingText.trim().length > 0
              ? textToHtml(row.pendingText)
              : "Your meeting link is pending — you'll receive it shortly.";
          out.push(
            `{{#unless has_meeting_link}}<p style="${CARD_PENDING_STYLE}">${pendingText}</p>\n{{/unless has_meeting_link}}`
          );
        }
        if (row.meetingMode === "join" || row.meetingMode === "auto") {
          out.push(
            `{{#unless no_meeting_link}}<p style="${CARD_JOIN_STYLE}"><a href="{{meeting_link}}" style="color:#4338CA;font-weight:600;">Join {{meeting_platform_label}} meeting</a></p>\n{{/unless no_meeting_link}}`
          );
        }
        break;
      case "zoom":
        if (row.enabled !== false) {
          out.push(
            `{{#unless no_zoom_account}}<p style="${CARD_ZOOM_STYLE}">Zoom account: {{zoom_account_label}} ({{zoom_account_email}})</p>\n{{/unless no_zoom_account}}`
          );
        }
        break;
    }
  }

  // Join rows with a newline between them, EXCEPT immediately after an element
  // that ends with a closing {{/unless ...}} tag (the original markup glues the
  // next token/row directly to the closing tag, e.g. `{{/unless is_feedback}}<p`).
  let result = "";
  for (let i = 0; i < out.length; i++) {
    if (i > 0 && !/{{\/unless\s+\w+}}\s*$/.test(out[i - 1])) result += "\n";
    result += out[i];
  }
  return result;
}

// ---------------------------------------------------------------------------
// Token helpers for the editor UI
// ---------------------------------------------------------------------------

export function tokenLabel(key: string): string {
  const labels: Record<string, string> = {
    participant_name: "Participant Name",
    participant_email: "Participant Email",
    admin_name: "Admin Name",
    admin_email: "Admin Email",
    project_name: "Project Name",
    availability_period: "Availability Period",
    session_date: "Session Date",
    session_time: "Session Time",
    time_zone: "Time Zone",
    meeting_link: "Meeting Link",
    booking_link: "Booking Link",
    manage_booking_link: "Manage Booking Link",
    company_logo: "Company Logo",
    company_name: "Company Name",
    reminder_label: "Reminder Label",
    is_feedback: "Is Feedback",
    meeting_platform_label: "Meeting Platform",
    has_meeting_link: "Has Meeting Link",
    no_meeting_link: "No Meeting Link",
    zoom_account_label: "Zoom Account",
    zoom_account_email: "Zoom Account Email",
    has_zoom_account: "Has Zoom Account",
    no_zoom_account: "No Zoom Account",
    pin: "Verification Code",
  };
  return labels[key] ?? key;
}

export function isKnownToken(key: string): boolean {
  return PLACEHOLDER_TOKENS.includes(key) || key === "pin";
}

// Split a text string (with {{token}} inline) into segments for chip rendering.
export type TextSegment = { kind: "text" | "token"; value: string };

export function splitSegments(text: string): TextSegment[] {
  const parts = text.split(/(\{\{[a-z_0-9]+\}\})/);
  const out: TextSegment[] = [];
  for (const part of parts) {
    if (!part) continue;
    const m = /^\{\{([a-z_0-9]+)\}\}$/.exec(part);
    if (m) out.push({ kind: "token", value: m[1] });
    else out.push({ kind: "text", value: part });
  }
  return out;
}

export function segmentsToText(segs: TextSegment[]): string {
  return segs.map((s) => (s.kind === "token" ? `{{${s.value}}}` : s.value)).join("");
}
