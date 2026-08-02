import Link from "next/link";
import { Calendar, ShieldAlert, ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default function AuthErrorPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const error = searchParams.error;
  const denied = error === "AccessDenied";

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      <header className="border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-brand-500" />
            <span className="font-bold text-gray-900 dark:text-gray-50">Scheduler</span>
          </Link>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-sm p-6 text-center">
            <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center">
              <ShieldAlert className="w-6 h-6 text-red-600 dark:text-red-300" />
            </div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-gray-50 mb-2">
              {denied ? "Access denied" : "Sign-in failed"}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
              {denied
                ? "This Microsoft account has not been invited to access Scheduler. Access is by invitation only."
                : "Something went wrong while signing you in. Please try again or contact your organisation owner."}
            </p>
            {denied && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
                If you expected access, ask your organisation owner to invite the email address you used to sign in.
              </p>
            )}
            <div className="mt-6 flex flex-col gap-2">
              <Link
                href="/auth/signin"
                className="w-full bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-lg py-2.5 transition-colors"
              >
                Back to sign in
              </Link>
              <Link
                href="/"
                className="inline-flex items-center justify-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mt-1"
              >
                <ArrowLeft className="w-3 h-3" />
                Go to home
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
