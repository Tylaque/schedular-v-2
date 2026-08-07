"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Loader2 } from "lucide-react";
import { verifyManageEmail } from "./actions";

export default function ManageBookingLocked({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleVerify = async () => {
    if (!email.trim() || verifying) return;
    setVerifying(true);
    setError(null);
    try {
      const result = await verifyManageEmail(bookingId, email.trim());
      if (result.verified) {
        router.push(`/manage/${bookingId}?token=${encodeURIComponent(result.token)}`);
      } else {
        setError(result.error);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-start justify-center p-4 pt-12">
      <div className="w-full max-w-2xl space-y-4">
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border p-6 space-y-5">
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-50">Manage your booking</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            To view or change this booking, confirm the email address you used when booking.
          </p>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError(null);
                }}
                onKeyDown={(e) => e.key === "Enter" && handleVerify()}
                placeholder="Enter your booking email"
                autoComplete="email"
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:bg-gray-800 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={handleVerify}
              disabled={verifying || !email.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-brand-500 rounded-lg hover:bg-brand-600 disabled:opacity-50 flex items-center gap-1.5"
            >
              {verifying && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Verify
            </button>
          </div>
          {error && <p className="text-sm text-red-600 dark:text-red-300">{error}</p>}
        </div>
      </div>
    </div>
  );
}
