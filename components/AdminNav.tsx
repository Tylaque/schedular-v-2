import Link from "next/link";

type AdminNavProps = {
  current: string;
  role?: string;
};

const ORG_OWNER_TABS = [
  { href: "/admin/my-area", label: "My Area" },
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/my-dashboard", label: "My Dashboard" },
  { href: "/admin/calendar", label: "Calendar" },
  { href: "/admin/projects", label: "Projects" },
  { href: "/admin/templates", label: "Templates" },
  { href: "/admin/templates/logs", label: "Notification Logs" },
  { href: "/admin/audit", label: "Audit Log" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/bulk-reschedule", label: "Bulk Reschedule" },
  { href: "/admin/waitlist", label: "Waitlist" },
];

const SUPER_ADMIN_TABS = [
  { href: "/admin/my-area", label: "My Area" },
  { href: "/admin/my-dashboard", label: "My Dashboard" },
  { href: "/admin/calendar", label: "Calendar" },
  { href: "/admin/projects", label: "Projects" },
  { href: "/admin/templates", label: "Templates" },
  { href: "/admin/templates/logs", label: "Notification Logs" },
  { href: "/admin/audit", label: "Audit Log" },
  { href: "/admin/reports", label: "Reports" },
];

const ADMIN_TABS = [
  { href: "/admin/my-area", label: "My Area" },
];

export default function AdminNav({ current, role }: AdminNavProps) {
  const tabs =
    role === "admin" ? ADMIN_TABS :
    role === "super_admin" ? SUPER_ADMIN_TABS :
    ORG_OWNER_TABS;

  return (
    <nav className="flex items-center gap-6 mb-6 border-b border-gray-200 pb-3">
      {tabs.map((tab) => (
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
