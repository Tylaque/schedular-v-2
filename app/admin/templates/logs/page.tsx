import { auth } from "@/auth";
import { listNotificationLogs } from "@/lib/data/notifications";
import NotificationLogsClient from "@/components/NotificationLogsClient";

export const dynamic = "force-dynamic";

export default async function NotificationLogsPage() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  const logs = await listNotificationLogs();

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-50">Notification Logs</h1>
        <p className="text-sm text-gray-500 mt-1 dark:text-gray-400">All email notifications sent by the system.</p>
      </div>

      {logs.length === 0 && (
        <div className="text-center py-16">
          <p className="text-sm text-gray-500 dark:text-gray-400">No notifications have been sent yet.</p>
        </div>
      )}

      {logs.length > 0 && <NotificationLogsClient logs={logs} />}
    </div>
  );
}
