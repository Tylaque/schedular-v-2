"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Calendar } from "lucide-react";

export default function SignInPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-brand-500" />
            <span className="font-bold text-gray-900">Scheduler</span>
          </Link>
          <nav className="flex items-center gap-4">
            <Link href="/auth/signup" className="text-sm font-medium text-brand-600 hover:text-brand-700">
              Sign up
            </Link>
          </nav>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-bold text-gray-900 text-center mb-1">Welcome back</h1>
          <p className="text-sm text-gray-500 text-center mb-8">Sign in to your Scheduler account.</p>

          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              router.push("/admin/projects");
            }}
          >
            <div>
              <label className="text-xs font-medium text-gray-500">Email</label>
              <input
                type="email"
                placeholder="you@company.com"
                className="w-full mt-1 text-sm border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500">Password</label>
              <input
                type="password"
                placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;"
                className="w-full mt-1 text-sm border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>
            <button
              type="submit"
              className="mt-1 w-full bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg py-2.5"
            >
              Sign in
            </button>
          </form>

          <p className="text-xs text-gray-400 text-center mt-6">
            Don&apos;t have an account?{" "}
            <Link href="/auth/signup" className="text-brand-600 hover:text-brand-700 font-medium">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
