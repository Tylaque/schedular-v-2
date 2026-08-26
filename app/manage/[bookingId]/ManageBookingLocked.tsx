"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Lock, Loader2, ArrowLeft } from "lucide-react";
import { requestManagePin, verifyManagePin } from "./actions";

export default function ManageBookingLocked({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [step, setStep] = useState<"email" | "pin">("email");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleRequestPin = async () => {
    if (!email.trim() || loading) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await requestManagePin(bookingId, email.trim());
      if (result.sent) {
        setSuccess("A verification code has been sent to your email.");
        setStep("pin");
      } else {
        setError(result.error);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyPin = async () => {
    if (!pin.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const result = await verifyManagePin(bookingId, email.trim(), pin.trim());
      if (result.verified) {
        router.push(`/manage/${bookingId}?token=${encodeURIComponent(result.token)}`);
      } else {
        setError(result.error);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
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

          {step === "email" ? (
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
                  onKeyDown={(e) => e.key === "Enter" && handleRequestPin()}
                  placeholder="Enter your booking email"
                  autoComplete="email"
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:bg-gray-800 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                />
              </div>
              <button
                onClick={handleRequestPin}
                disabled={loading || !email.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-brand-500 rounded-lg hover:bg-brand-600 disabled:opacity-50 flex items-center gap-1.5"
              >
                {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Send code
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Enter the 6-digit code sent to <span className="font-medium text-gray-700 dark:text-gray-200">{email}</span>
              </p>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
                  <input
                    type="text"
                    value={pin}
                    onChange={(e) => {
                      setPin(e.target.value.replace(/\D/g, "").slice(0, 6));
                      setError(null);
                    }}
                    onKeyDown={(e) => e.key === "Enter" && handleVerifyPin()}
                    placeholder="000000"
                    maxLength={6}
                    autoComplete="one-time-code"
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:bg-gray-800 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent tracking-widest font-mono"
                  />
                </div>
                <button
                  onClick={handleVerifyPin}
                  disabled={loading || pin.length !== 6}
                  className="px-4 py-2 text-sm font-medium text-white bg-brand-500 rounded-lg hover:bg-brand-600 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Verify
                </button>
              </div>
              <button
                onClick={() => {
                  setStep("email");
                  setPin("");
                  setError(null);
                  setSuccess(null);
                }}
                className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 flex items-center gap-1"
              >
                <ArrowLeft className="w-3 h-3" />
                Use a different email
              </button>
            </div>
          )}

          {error && <p className="text-sm text-red-600 dark:text-red-300">{error}</p>}
          {success && <p className="text-sm text-green-600 dark:text-green-300">{success}</p>}
        </div>
      </div>
    </div>
  );
}
