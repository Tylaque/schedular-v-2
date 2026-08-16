import { Info } from "lucide-react";

export default function ManageBookingResolved({
  status,
}: {
  status: "confirmed" | "cancelled" | "rescheduled" | "completed";
}) {
  const message =
    status === "cancelled"
      ? "This booking has been cancelled."
      : status === "rescheduled"
        ? "This booking has already been rescheduled."
        : status === "completed"
          ? "This session has already taken place."
          : "This booking can no longer be changed.";

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-start justify-center p-4 pt-12">
      <div className="w-full max-w-2xl">
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border p-6 space-y-3">
          <div className="flex items-start gap-2 rounded-lg p-3 text-sm bg-gray-50 border border-gray-200 text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-medium">Manage your booking</p>
              <p>{message}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                If you would like to book a new session, use the booking link for the project.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
