import Link from "next/link";
import {
  Calendar,
  Clock,
  Users,
  CheckCircle,
  ArrowRight,
  Settings,
} from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-brand-500" />
            <span className="font-bold text-gray-900">Scheduler</span>
          </div>
          <nav className="flex items-center gap-4">
            <Link href="/auth/signin" className="text-sm font-medium text-gray-600 hover:text-gray-900">
              Sign in
            </Link>
            <Link
              href="/auth/signup"
              className="bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg px-4 py-2"
            >
              Sign up
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 py-20 md:py-28 text-center">
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 leading-tight max-w-3xl mx-auto">
          Schedule across teams, projects, and time zones.
        </h1>
        <p className="text-lg text-gray-500 mt-4 max-w-xl mx-auto">
          A Doodle-style scheduling platform where Super Admins configure projects, Admins submit their availability, and participants book from consolidated slots.
        </p>
        <div className="flex items-center justify-center gap-3 mt-8">
          <Link
            href="/auth/signup"
            className="bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg px-6 py-3"
          >
            Get started
            <ArrowRight className="w-4 h-4 inline ml-1.5" />
          </Link>
          <Link
            href="/admin/projects"
            className="border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg text-sm font-medium px-6 py-3"
          >
            View demo
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-gray-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-16 md:py-20">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-10">How it works</h2>
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
                desc: "Each Admin marks their available slots on a Doodle-style grid. Results consolidate automatically.",
              },
              {
                icon: <CheckCircle className="w-6 h-6" />,
                title: "Participants book",
                desc: "Invited participants see the consolidated calendar and book the slot that works for them — no back-and-forth.",
              },
            ].map((f) => (
              <div key={f.title} className="border border-gray-200 rounded-lg p-6">
                <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center text-brand-500 mb-4">
                  {f.icon}
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features grid */}
      <section className="max-w-6xl mx-auto px-6 py-16 md:py-20">
        <h2 className="text-2xl font-bold text-gray-900 text-center mb-10">Everything you need</h2>
        <div className="grid md:grid-cols-2 gap-6">
          {[
            { icon: <Clock className="w-5 h-5" />, title: "Duration & buffers", desc: "Set slot duration, buffer gaps between sessions, and daily limits per admin." },
            { icon: <Calendar className="w-5 h-5" />, title: "Availability windows", desc: "Pick date ranges, lock dates, and enforce minimum notice periods." },
            { icon: <Users className="w-5 h-5" />, title: "Admin load balancing", desc: "Sessions auto-assign across the admin pool for even distribution." },
            { icon: <CheckCircle className="w-5 h-5" />, title: "Slot consolidation", desc: "Available hours from all admins merge into one unified participant view." },
          ].map((f) => (
            <div key={f.title} className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center text-brand-500 shrink-0 mt-0.5">
                {f.icon}
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 text-sm">{f.title}</h3>
                <p className="text-sm text-gray-500 mt-0.5">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-gray-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-16 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Ready to streamline your scheduling?</h2>
          <p className="text-sm text-gray-500 mb-6">Start with a demo project, no account required.</p>
          <Link
            href="/admin/projects"
            className="bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg px-6 py-3 inline-block"
          >
            Explore the demo
            <ArrowRight className="w-4 h-4 inline ml-1.5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-gray-50">
        <div className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between text-xs text-gray-400">
          <span>&copy; {new Date().getFullYear()} Scheduler. All rights reserved.</span>
          <span>Built with Next.js, Prisma, and Tailwind CSS.</span>
        </div>
      </footer>
    </div>
  );
}
