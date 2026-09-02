import Link from "next/link";
import {
  ArrowRight,
  SlidersHorizontal,
  CalendarDays,
  Scale,
  Gauge,
  FolderKanban,
  Timer,
  CalendarRange,
  Link2,
  MailCheck,
  KeyRound,
  Video,
  ClipboardList,
  UsersRound,
  BarChart3,
  PanelsTopLeft,
  ShieldCheck,
  Lock,
  ScrollText,
  Fingerprint,
} from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";

export const metadata = {
  title: "Eureka — scheduling for people, programs, and operations",
  description:
    "Eureka is a scheduling platform where coordinators set the rules, team leads give real availability, and participants book from a single consolidated calendar.",
};

const NAV_LINKS = [
  { label: "How it works", href: "#how-it-works" },
  { label: "Features", href: "#features" },
];

const PROOF_CARDS = [
  {
    icon: <SlidersHorizontal className="w-5 h-5" />,
    title: "One config per project",
    desc: "Rules set once — windows, duration, buffers, limits. Every booking follows them.",
  },
  {
    icon: <CalendarDays className="w-5 h-5" />,
    title: "Consolidated view",
    desc: "Admins' availability merges into one set of bookable slots. You see the whole pool, not a calendar at a time.",
  },
  {
    icon: <Scale className="w-5 h-5" />,
    title: "Load-balanced",
    desc: "Bookings distribute across the admin pool so no single person carries the load.",
  },
  {
    icon: <Gauge className="w-5 h-5" />,
    title: "Visibility you can act on",
    desc: "Capacity dashboards, decision-ready reports, a needs-attention list, and a full audit trail.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "A coordinator sets the rules",
    desc: "Define the project, scheduling rules, and team once.",
  },
  {
    n: "02",
    title: "Admins give honest availability",
    desc: "Mark open slots on a visual grid. No spreadsheet chasing.",
  },
  {
    n: "03",
    title: "Participants book",
    desc: "They see the consolidated calendar, book in one click, and get confirmation, reminders, and a secure manage link automatically. No account needed.",
  },
];

const FEATURES = [
  { icon: <FolderKanban className="w-5 h-5" />, title: "Projects & scheduling rules", desc: "Per-project configuration of the whole program." },
  { icon: <CalendarRange className="w-5 h-5" />, title: "Availability windows", desc: "Date ranges, lock dates, and minimum notice periods." },
  { icon: <Timer className="w-5 h-5" />, title: "Duration, buffers & limits", desc: "Slot length, gaps between sessions, and daily limits per admin." },
  { icon: <Scale className="w-5 h-5" />, title: "Load balancing", desc: "Sessions auto-assign across the admin pool." },
  { icon: <CalendarDays className="w-5 h-5" />, title: "Consolidated calendar", desc: "Every admin's hours merge into one participant view." },
  { icon: <Link2 className="w-5 h-5" />, title: "Per-participant links", desc: "Signed booking links for each invited participant." },
  { icon: <MailCheck className="w-5 h-5" />, title: "Confirmations & reminders", desc: "Automatic emails on booking, and schedule reminders." },
  { icon: <KeyRound className="w-5 h-5" />, title: "Secure manage flow", desc: "Reschedule or cancel behind a unique token and PIN." },
  { icon: <Video className="w-5 h-5" />, title: "Video-call provisioning", desc: "Zoom appointments when a program needs them." },
  { icon: <ClipboardList className="w-5 h-5" />, title: "Waitlist & recovery", desc: "Open slots get reclaimed instead of wasted." },
  { icon: <UsersRound className="w-5 h-5" />, title: "Team & roles", desc: "Super Admin to Project Admin to Admin — scoped access." },
  { icon: <BarChart3 className="w-5 h-5" />, title: "Dashboards, reports, audit", desc: "Capacity, decisions, and accountability in one place." },
  { icon: <PanelsTopLeft className="w-5 h-5" />, title: "Email templates you control", desc: "A block editor for confirmation and reminder wording." },
];

const TRUST_ITEMS = [
  {
    icon: <ShieldCheck className="w-5 h-5" />,
    title: "Role-based access",
    desc: "Super Admins, Project Admins, and Admins — each scoped to what their role permits.",
  },
  {
    icon: <Fingerprint className="w-5 h-5" />,
    title: "Secure signed links + PIN",
    desc: "Token-protected booking links, and a manage flow that requires a PIN.",
  },
  {
    icon: <ScrollText className="w-5 h-5" />,
    title: "Full audit trail",
    desc: "Booking events, access, and notification sends are logged.",
  },
  {
    icon: <Lock className="w-5 h-5" />,
    title: "Encrypted in transit",
    desc: "All traffic to Eureka is served over TLS.",
  },
];

const ROADMAP_ITEMS = [
  "Multi-tenant organizations — per-org control and isolation",
  "Calendar integrations — Google / Outlook sync",
  "Admin blocking & PTO-aware availability",
  "Audit export & data-retention controls",
];

const LEGAL_LINKS = [
  { label: "Privacy Notice", href: "/legal/privacy-notice" },
  { label: "Customer Terms", href: "/legal/customer-terms" },
  { label: "Participant Terms", href: "/legal/participant-terms" },
  { label: "Acceptable Use Policy", href: "/legal/acceptable-use-policy" },
  { label: "Data Processing Addendum", href: "/legal/data-processing-addendum" },
];

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold tracking-widest uppercase text-accent-600 dark:text-accent-400">
      {children}
    </p>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="h-1 bg-accent-600" />

      <header className="border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-accent-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm leading-none">E</span>
            </div>
            <span className="font-semibold text-gray-900 dark:text-gray-50">Eureka</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
              >
                {l.label}
              </a>
            ))}
          </nav>
          <nav className="flex items-center gap-4">
            <ThemeToggle />
            <Link
              href="/auth/signin"
              className="text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
            >
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-6 pt-20 pb-16 md:pt-28 md:pb-24 text-center">
        <Eyebrow>Scheduling operations</Eyebrow>
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-gray-50 leading-tight max-w-3xl mx-auto mt-4">
          Run people-heavy scheduling like a single operation, not an inbox.
        </h1>
        <p className="text-lg text-gray-500 dark:text-gray-400 mt-5 max-w-xl mx-auto">
          Eureka is one place where coordinators set the rules, team leads give real
          availability, and participants book from a single consolidated calendar.
        </p>
        <div className="flex items-center justify-center gap-3 mt-8">
          <Link
            href="/book/senior-pm-interview"
            className="bg-accent-600 hover:bg-accent-500 text-white text-sm font-semibold rounded-lg px-6 py-3 inline-flex items-center"
          >
            Explore the demo
            <ArrowRight className="w-4 h-4 ml-1.5" />
          </Link>
          <a
            href="#how-it-works"
            className="border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800 rounded-lg text-sm font-medium px-6 py-3"
          >
            How it works
          </a>
        </div>
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-10">
          The demo program is live now — Senior PM Interview. Booking takes under a minute.
        </p>
      </section>

      <section id="control" className="border-t border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="max-w-6xl mx-auto px-6 py-16 md:py-20">
          <div className="max-w-2xl">
            <Eyebrow>Proof of control</Eyebrow>
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-50 mt-3">
              Owner-level control, end to end
            </h2>
          </div>
          <div className="grid md:grid-cols-2 gap-6 mt-10">
            {PROOF_CARDS.map((c) => (
              <div
                key={c.title}
                className="border border-gray-200 dark:border-gray-700 rounded-lg p-6"
              >
                <div className="w-10 h-10 rounded-lg bg-accent-50 flex items-center justify-center text-accent-600 mb-4 dark:bg-accent-500/15 dark:text-accent-300">
                  {c.icon}
                </div>
                <h3 className="font-bold text-gray-900 dark:text-gray-50 mb-2">{c.title}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{c.desc}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-8">
            No AI, no black box. You set the rules; the schedule and the audit trail show what happened.
          </p>
        </div>
      </section>

      <section id="how-it-works" className="max-w-6xl mx-auto px-6 py-16 md:py-20">
        <div className="max-w-2xl">
          <Eyebrow>How it works</Eyebrow>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-50 mt-3">
            Three steps, no back-and-forth
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-8 mt-10">
          {STEPS.map((s) => (
            <div key={s.n} className="border-t-2 border-gray-200 dark:border-gray-700 pt-6">
              <span className="text-3xl font-black text-gray-300 dark:text-gray-700">{s.n}</span>
              <h3 className="font-bold text-gray-900 dark:text-gray-50 mt-3 mb-2">{s.title}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="features" className="border-t border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="max-w-6xl mx-auto px-6 py-16 md:py-20">
          <div className="max-w-2xl">
            <Eyebrow>Current features</Eyebrow>
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-50 mt-3">
              Everything in the current product
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              All of the above is built and live today.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mt-10">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-accent-50 flex items-center justify-center text-accent-600 shrink-0 mt-0.5 dark:bg-accent-500/15 dark:text-accent-300">
                  {f.icon}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-50 text-sm">{f.title}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="trust" className="max-w-6xl mx-auto px-6 py-16 md:py-20">
        <div className="max-w-2xl">
          <Eyebrow>Data protection</Eyebrow>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-50 mt-3">
            Stated plainly, only what we can verify
          </h2>
        </div>
        <div className="grid md:grid-cols-2 gap-6 mt-10">
          {TRUST_ITEMS.map((t) => (
            <div key={t.title} className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-accent-50 flex items-center justify-center text-accent-600 shrink-0 mt-0.5 dark:bg-accent-500/15 dark:text-accent-300">
                {t.icon}
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-50 text-sm">{t.title}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{t.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-8">
          We only state protections we can verify. No certifications claimed.
        </p>
      </section>

      <section id="roadmap" className="border-t border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="max-w-6xl mx-auto px-6 py-16 md:py-20">
          <div className="max-w-2xl">
            <Eyebrow>Roadmap</Eyebrow>
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-50 mt-3">
              Where we&apos;re headed
            </h2>
            <span className="inline-block mt-4 border border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-400/40 dark:bg-amber-400/10 dark:text-amber-300 text-xs font-semibold rounded-full px-3 py-1">
              NOT YET BUILT — not part of the current product
            </span>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
              These are direction items. They are not built, not scheduled, and not part of
              today&apos;s feature set.
            </p>
          </div>
          <ul className="mt-10 grid md:grid-cols-2 gap-x-8 gap-y-3">
            {ROADMAP_ITEMS.map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm text-gray-600 dark:text-gray-300">
                <span className="w-2 h-2 rounded-sm bg-gray-300 dark:bg-gray-600 mt-1.5 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-16 md:py-20 text-center">
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-50">
          See it with a real project.
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-3 max-w-md mx-auto">
          Book a slot in the live demo program — no account, no sign-up.
        </p>
        <Link
          href="/book/senior-pm-interview"
          className="inline-flex items-center bg-accent-600 hover:bg-accent-500 text-white text-sm font-semibold rounded-lg px-6 py-3 mt-6"
        >
          Explore the demo
          <ArrowRight className="w-4 h-4 ml-1.5" />
        </Link>
      </section>

      <footer className="border-t border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-950">
        <div className="max-w-6xl mx-auto px-6 py-10">
          <div className="flex flex-col md:flex-row md:items-start gap-6 md:justify-between">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-accent-600 flex items-center justify-center">
                  <span className="text-white font-bold text-xs leading-none">E</span>
                </div>
                <span className="font-semibold text-gray-900 dark:text-gray-50 text-sm">
                  Eureka
                </span>
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                &copy; {new Date().getFullYear()} Eureka. All rights reserved.
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                Built by FidLaque Solutions.
              </p>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-2 max-w-xl">
              {LEGAL_LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="text-xs text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                >
                  {l.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}