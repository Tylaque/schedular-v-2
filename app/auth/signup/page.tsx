"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { Calendar, ArrowLeft } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      <header className="border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-brand-500" />
            <span className="font-bold text-gray-900 dark:text-gray-50">Scheduler</span>
          </Link>
          <nav className="flex items-center gap-4">
            <ThemeToggle />
            <Link href="/auth/signin" className="text-sm font-medium text-brand-600 hover:text-brand-700">
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50 text-center mb-1">Access by invitation only</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-8">
            Scheduler accounts are created by your organisation owner.
          </p>

          <div className="rounded-lg bg-blue-50 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-800 p-4 mb-6">
            <p className="text-sm text-blue-800 dark:text-blue-200 leading-relaxed">
              <strong>Already have an invite?</strong> Check your email for a setup link from your organisation
              owner. If the email you were invited with is a Microsoft account, you can sign in below instead.
            </p>
          </div>

          <button
            onClick={() => signIn("azure-ad", { redirectTo: "/admin/projects" })}
            className="w-full bg-gray-900 hover:bg-gray-800 text-white text-sm font-semibold rounded-lg py-2.5 flex items-center justify-center gap-2"
          >
            <svg viewBox="0 0 21 21" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
              <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
              <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
              <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
            </svg>
            Sign in with Microsoft
          </button>

          <p className="text-xs text-gray-400 dark:text-gray-500 text-center mt-6">
            Already have an account?{" "}
            <Link href="/auth/signin" className="text-brand-600 hover:text-brand-700 font-medium">
              Sign in
            </Link>
          </p>

          <p className="text-xs text-gray-400 dark:text-gray-500 text-center mt-3">
            <Link href="/auth/signin" className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 inline-flex items-center gap-1">
              <ArrowLeft className="w-3 h-3" />
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
