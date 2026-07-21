"use client";

import Link from "next/link";
import { Calendar, ArrowLeft, Mail } from "lucide-react";
import { useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/request-password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data?.error ?? "Something went wrong. Please try again.");
        return;
      }
      setSubmitted(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-brand-500" />
            <span className="font-bold text-gray-900">Scheduler</span>
          </Link>
          <nav className="flex items-center gap-4">
            <Link href="/auth/signin" className="text-sm font-medium text-brand-600 hover:text-brand-700">
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          {!submitted ? (
            <>
              <h1 className="text-2xl font-bold text-gray-900 text-center mb-1">Forgot your password?</h1>
              <p className="text-sm text-gray-500 text-center mb-8">
                Enter your email address and we&apos;ll send you a reset link.
              </p>

              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email address
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  />
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-brand-600 hover:bg-brand-700 disabled:bg-brand-300 text-white text-sm font-semibold rounded-lg py-2.5 flex items-center justify-center gap-2 transition-colors"
                >
                  <Mail className="w-4 h-4" />
                  {loading ? "Sending..." : "Send reset link"}
                </button>
              </form>

              <p className="text-xs text-gray-400 text-center mt-6">
                <Link href="/auth/signin" className="text-gray-500 hover:text-gray-700 inline-flex items-center gap-1">
                  <ArrowLeft className="w-3 h-3" />
                  Back to sign in
                </Link>
              </p>
            </>
          ) : (
            <div className="text-center">
              <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 mb-6">
                <p className="text-sm text-blue-800 font-semibold">Check your email</p>
                <p className="text-sm text-blue-700 mt-1 leading-relaxed">
                  If an account exists for this email address, we&apos;ll send a password reset link. Check your inbox
                  and follow the instructions.
                </p>
              </div>
              <Link
                href="/auth/signin"
                className="text-sm text-brand-600 hover:text-brand-700 font-medium"
              >
                Back to sign in
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
