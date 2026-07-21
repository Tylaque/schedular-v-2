import { auth } from "@/auth";
import Link from "next/link";
import { listNotificationLogs, CATEGORY_LABEL } from "@/lib/data/notifications";
import { CheckCircle2, XCircle, Send } from "lucide-react";
import AdminNav from "@/components/AdminNav";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, string> = {
  sent: "bg-emerald-100 text-emerald-700",
  failed: "bg-red-100 text-red-700",
  test: "bg-gray-100 text-gray-500",
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  sent: <CheckCircle2 className="w-4 h-4 text-emerald-600" />,
  failed: <XCircle className="w-4 h-4 text-red-500" />,
  test: <Send className="w-4 h-4 text-gray-400" />,
};

export default async function NotificationLogsPage() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  const logs = await listNotificationLogs();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto p-6">
        <AdminNav current="/admin/templates/logs" role={role} />
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">Notification Logs</h1>
          <p className="text-sm text-gray-500 mt-1">All email notifications sent by the system.</p>
        </div>

        {logs.length === 0 && (
          <div className="text-center py-16">
            <p className="text-sm text-gray-500">No notifications have been sent yet.</p>
          </div>
        )}

        {logs.length > 0 && (
          <div className="overflow-x-auto border border-gray-200 rounded-lg bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Timestamp</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Category</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Recipient</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Subject</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-gray-200 last:border-b-0">
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {log.createdAt.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-gray-900">
                      {CATEGORY_LABEL.get(log.category) ?? log.category}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{log.recipientEmail}</td>
                    <td className="px-4 py-3 text-gray-700 max-w-xs truncate">{log.subject}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[log.status] ?? ""}`}>
                        {STATUS_ICON[log.status] ?? null}
                        {log.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
