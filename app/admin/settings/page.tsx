import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import NotificationPreferencesForm from "@/components/NotificationPreferencesForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/signin");
  }

  const admin = await db.admin.findUnique({
    where: { id: session.user.id },
    select: { notifyOnBooking: true },
  });

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-50">Settings</h1>
      <p className="text-sm text-gray-500 mt-1 mb-6 dark:text-gray-400">
        Preferences for your account.
      </p>
      <NotificationPreferencesForm initialEnabled={admin?.notifyOnBooking ?? true} />
    </div>
  );
}
