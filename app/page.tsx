// Auth via Microsoft Entra ID (multi-tenant + personal accounts).
// See auth.ts for configuration.

import Link from "next/link";
import {
  Calendar,
  Clock,
  Users,
  CheckCircle,
  ArrowRight,
  Settings,
} from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Nav */}
      <header className="border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center">
              <span className="text-white font-bold text-sm leading-none">S</span>
            </div>
            <span className="font-semibold text-gray-900 dark:text-gray-50">Scheduler</span>
          </div>
          <nav className="flex items-center gap-4">
            <ThemeToggle />
            <Link href="/auth/signin" className="text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100">
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 py-20 md:py-28 text-center">
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-gray-50 leading-tight max-w-3xl mx-auto">
          Schedule across teams, projects, and time zones.
        </h1>
        <p className="text-lg text-gray-500 dark:text-gray-400 mt-4 max-w-xl mx-auto">
          A scheduling platform where Super Admins configure projects, Admins submit their availability, and participants book from consolidated slots.
        </p>
        <div className="flex items-center justify-center gap-3 mt-8">
          <Link
            href="/auth/signin"
            className="bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg px-6 py-3"
          >
            Get started
            <ArrowRight className="w-4 h-4 inline ml-1.5" />
          </Link>
          <Link
            href="/book/senior-pm-interview"
            className="border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800 rounded-lg text-sm font-medium px-6 py-3"
          >
            View demo
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
        <div className="max-w-6xl mx-auto px-6 py-16 md:py-20">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-50 text-center mb-10">How it works</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: <Settings className="w-6 h-6" />,
                title: "Super Admin configures",
                desc: "Define projects, set scheduling rules, assign Admins, and control availability windows — all in one place.",
              },
              {
                icon: <Users className="w-6 h-6" />,
                title: "Admins submit availability",
                desc: "Each Admin marks their available slots on a visual grid. Results consolidate automatically.",
              },
              {
                icon: <CheckCircle className="w-6 h-6" />,
                title: "Participants book",
                desc: "Invited participants see the consolidated calendar and book the slot that works for them — no back-and-forth.",
              },
            ].map((f) => (
              <div key={f.title} className="border border-gray-200 dark:border-gray-700 rounded-lg p-6">
                <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center text-brand-500 mb-4 dark:bg-brand-700/40">
                  {f.icon}
                </div>
                <h3 className="font-bold text-gray-900 dark:text-gray-50 mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features grid */}
      <section className="max-w-6xl mx-auto px-6 py-16 md:py-20">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-50 text-center mb-10">Everything you need</h2>
        <div className="grid md:grid-cols-2 gap-6">
          {[
            { icon: <Clock className="w-5 h-5" />, title: "Duration & buffers", desc: "Set slot duration, buffer gaps between sessions, and daily limits per admin." },
            { icon: <Calendar className="w-5 h-5" />, title: "Availability windows", desc: "Pick date ranges, lock dates, and enforce minimum notice periods." },
            { icon: <Users className="w-5 h-5" />, title: "Admin load balancing", desc: "Sessions auto-assign across the admin pool for even distribution." },
            { icon: <CheckCircle className="w-5 h-5" />, title: "Slot consolidation", desc: "Available hours from all admins merge into one unified participant view." },
          ].map((f) => (
            <div key={f.title} className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center text-brand-500 shrink-0 mt-0.5 dark:bg-brand-700/40">
                {f.icon}
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-50 text-sm">{f.title}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
        <div className="max-w-6xl mx-auto px-6 py-16 text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-50 mb-3">Ready to streamline your scheduling?</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Start with a demo project, no account required.</p>
          <Link
            href="/book/senior-pm-interview"
            className="bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg px-6 py-3 inline-block"
          >
            Explore the demo
            <ArrowRight className="w-4 h-4 inline ml-1.5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-950">
        <div className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between text-xs text-gray-400 dark:text-gray-500">
          <span>&copy; {new Date().getFullYear()} Scheduler. All rights reserved.</span>
          <span>Built by FidLaque Solutions.</span>
        </div>
      </footer>
    </div>
  );
}
