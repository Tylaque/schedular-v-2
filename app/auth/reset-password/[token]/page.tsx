"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { Calendar } from "lucide-react";
import { PasswordSetupForm } from "@/components/PasswordSetupForm";
import ThemeToggle from "@/components/ThemeToggle";

export default function ResetPasswordPage() {
  const params = useParams();
  const token = params?.token as string;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      <header className="border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-brand-500" />
            <span className="font-bold text-gray-900 dark:text-gray-50">Scheduler</span>
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <PasswordSetupForm token={token} type="reset" />
        </div>
      </div>
    </div>
  );
}
