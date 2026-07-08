"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveTemplateAction, sendTestAction } from "@/lib/actions";
import { PLACEHOLDER_TOKENS, renderTemplate, MOCK_PREVIEW_CONTEXT } from "@/lib/template-utils";
import type { Prisma } from "@prisma/client";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Send,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";

const CATEGORY_LABELS: Record<string, string> = {
  admin_invitation: "Admin Invitation",
  availability_request: "Availability Request",
  participant_invitation: "Participant Invitation",
  booking_confirmation: "Booking Confirmation",
  reminder_24h: "24h Reminder",
  reminder_1h: "1h Reminder",
  reschedule_notice: "Reschedule Notice",
  cancellation_notice: "Cancellation Notice",
  waitlist_offer: "Waitlist Offer",
};

export default function TemplateEditForm({
  template,
  history,
  notificationLogs,
}: {
  template: Prisma.EmailTemplateGetPayload<{}>;
  history: Prisma.EmailTemplateGetPayload<{}>[];
  notificationLogs: Prisma.NotificationLogGetPayload<{}>[];
}) {
  const router = useRouter();
  const [subject, setSubject] = useState(template.subject);
  const [bodyHtml, setBodyHtml] = useState(template.bodyHtml);
  const [showPreview, setShowPreview] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [testSent, setTestSent] = useState(false);

  const renderedPreview = showPreview
    ? renderTemplate({ subject, bodyHtml }, MOCK_PREVIEW_CONTEXT)
    : null;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await saveTemplateAction({
      category: template.category as any,
      audience: template.audience as any,
      projectId: template.projectId,
      subject,
      bodyHtml,
    });
    router.push("/admin/templates");
  }

  async function handleSendTest() {
    if (!testEmail) return;
    setSending(true);
    await sendTestAction(template.id, testEmail);
    setSending(false);
    setTestSent(true);
    setTimeout(() => setTestSent(false), 3000);
  }

  function insertToken(token: string) {
    setBodyHtml((prev) => prev + `{{${token}}}`);
  }

  const statusIcon: Record<string, React.ReactNode> = {
    sent: <CheckCircle2 className="w-4 h-4 text-emerald-600" />,
    failed: <XCircle className="w-4 h-4 text-red-500" />,
    test: <Send className="w-4 h-4 text-gray-400" />,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-6">
        <button
          onClick={() => router.push("/admin/templates")}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> Back to templates
        </button>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {CATEGORY_LABELS[template.category] ?? template.category}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              v{template.version} · {template.audience} ·{" "}
              {template.projectId ? "Project override" : "Global default"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-500">Subject</label>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full mt-1 text-sm border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-gray-500">Body (HTML)</label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">Insert token:</span>
                    <select
                      onChange={(e) => { if (e.target.value) insertToken(e.target.value); e.target.value = ""; }}
                      className="text-xs border border-gray-300 rounded px-2 py-1 bg-white text-gray-700"
                    >
                      <option value="">-- select --</option>
                      {PLACEHOLDER_TOKENS.map((t) => (
                        <option key={t} value={t}>{`{{${t}}}`}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <textarea
                  value={bodyHtml}
                  onChange={(e) => setBodyHtml(e.target.value)}
                  rows={16}
                  className="w-full mt-1 text-sm font-mono border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>

              {renderedPreview && (
                <div className="border border-gray-200 rounded-lg bg-white">
                  <div className="px-4 py-3 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Preview — Subject: {renderedPreview.subject}
                  </div>
                  <div className="p-4" dangerouslySetInnerHTML={{ __html: renderedPreview.bodyHtml }} />
                </div>
              )}

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowPreview(!showPreview)}
                  className="border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg px-4 py-2 text-sm font-medium flex items-center gap-2"
                >
                  {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  {showPreview ? "Hide preview" : "Show preview"}
                </button>
                <button
                  type="submit"
                  disabled={!subject || !bodyHtml || saving}
                  className="bg-brand-500 hover:bg-brand-600 disabled:bg-gray-300 text-white text-sm font-semibold rounded-lg px-6 py-2.5"
                >
                  {saving ? "Saving..." : "Save as new version"}
                </button>
              </div>
            </form>
          </div>

          <div className="space-y-6">
            {/* Send test email */}
            <div className="border border-gray-200 rounded-lg bg-white p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Send className="w-4 h-4 text-gray-400" /> Send test
              </h3>
              <div className="flex gap-2">
                <input
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="test@email.com"
                  className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2"
                />
                <button
                  onClick={handleSendTest}
                  disabled={!testEmail || sending}
                  className="border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-300 rounded-lg px-3 py-2 text-sm font-medium flex items-center gap-1"
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
              {testSent && (
                <p className="mt-2 text-xs text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Test logged (no real email sent)
                </p>
              )}
              <p className="mt-2 text-xs text-gray-400">
                This does not send a real email — it resolves the template and logs a test row.
              </p>
            </div>

            {/* Version history */}
            <div className="border border-gray-200 rounded-lg bg-white p-4">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="flex items-center justify-between w-full text-sm font-semibold text-gray-900"
              >
                <span className="flex items-center gap-2"><Clock className="w-4 h-4 text-gray-400" /> History ({history.length})</span>
                <span className="text-gray-400">{showHistory ? "▲" : "▼"}</span>
              </button>
              {showHistory && (
                <div className="mt-3 space-y-2 max-h-60 overflow-y-auto">
                  {history.map((h) => (
                    <div
                      key={h.id}
                      className={`text-xs p-2 rounded ${
                        h.id === template.id ? "bg-brand-50 border border-brand-200" : "bg-gray-50"
                      }`}
                    >
                      <div className="font-medium text-gray-700">
                        v{h.version} {h.id === template.id ? "(current)" : ""}
                      </div>
                      <div className="text-gray-400 mt-0.5 truncate">{h.subject}</div>
                      <div className="text-gray-400">
                        {h.isActive ? "Active" : "Inactive"} · {h.createdAt.toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent notification logs */}
            {notificationLogs.length > 0 && (
              <div className="border border-gray-200 rounded-lg bg-white p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Send className="w-4 h-4 text-gray-400" /> Recent sends ({notificationLogs.length})
                </h3>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {notificationLogs.map((log) => (
                    <div key={log.id} className="text-xs p-2 rounded bg-gray-50">
                      <div className="flex items-center gap-1.5">
                        {statusIcon[log.status] ?? null}
                        <span className="text-gray-700">{log.recipientEmail}</span>
                      </div>
                      <div className="text-gray-400 mt-0.5">{log.createdAt.toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
