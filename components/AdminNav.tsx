import Link from "next/link";

const TABS = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/my-dashboard", label: "My Dashboard" },
  { href: "/admin/calendar", label: "Calendar" },
  { href: "/admin/projects", label: "Projects" },
  { href: "/admin/templates", label: "Templates" },
  { href: "/admin/templates/logs", label: "Notification Logs" },
];

export default function AdminNav({ current }: { current: string }) {
  return (
    <nav className="flex items-center gap-6 mb-6 border-b border-gray-200 pb-3">
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={
            tab.href === current
              ? "text-sm font-semibold text-brand-600"
              : "text-sm font-medium text-gray-500 hover:text-gray-700"
          }
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
