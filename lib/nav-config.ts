import type { LucideIcon } from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  roles: string[];
  icon?: string;
};

export type NavLink = {
  type: "link";
  icon?: string;
  items: NavItem[];
  divider?: boolean;
};

export type NavGroup = {
  type: "dropdown";
  label: string;
  icon?: string;
  badge?: boolean;
  defaultExpanded?: boolean;
  items: NavItem[];
};

export type NavSection = NavLink | NavGroup;

export const NAV_CONFIG: NavSection[] = [
  {
    type: "dropdown",
    label: "Dashboard",
    icon: "LayoutDashboard",
    defaultExpanded: true,
    items: [
      { label: "My Area", href: "/admin/my-area", roles: ["admin", "super_admin", "org_owner"], icon: "User" },
      { label: "Dashboard", href: "/admin/dashboard", roles: ["org_owner"], icon: "LayoutDashboard" },
      { label: "My Dashboard", href: "/admin/my-dashboard", roles: ["super_admin", "org_owner"], icon: "BarChart3" },
    ],
  },
  { type: "link", icon: "FolderKanban", items: [
    { label: "Projects", href: "/admin/projects", roles: ["super_admin", "org_owner"], icon: "FolderKanban" },
  ]},
  { type: "link", icon: "CalendarDays", items: [
    { label: "Calendar", href: "/admin/calendar", roles: ["super_admin", "org_owner"], icon: "CalendarDays" },
  ]},
  { type: "dropdown", label: "Availability", icon: "Clock", items: [
    { label: "My Availability", href: "/admin/my-availability", roles: ["admin", "super_admin", "org_owner"], icon: "Clock" },
    { label: "Team Availability", href: "/admin/team-availability", roles: ["super_admin", "org_owner"], icon: "Users" },
  ]},
  { type: "dropdown", label: "Manage", icon: "Users", items: [
    { label: "Team", href: "/admin/team", roles: ["super_admin", "org_owner"], icon: "Users" },
    { label: "Certifications", href: "/admin/certifications", roles: ["org_owner"], icon: "BadgeCheck" },
    { label: "Session Types", href: "/admin/session-types", roles: ["org_owner"], icon: "Tag" },
    { label: "Zoom Pool", href: "/admin/zoom-pool", roles: ["super_admin", "org_owner"], icon: "Video" },
    { label: "Templates", href: "/admin/templates", roles: ["super_admin", "org_owner"], icon: "Mail" },
  ]},
  {
    type: "dropdown",
    label: "Operations",
    icon: "AlertTriangle",
    badge: true,
    items: [
      { label: "Needs Attention", href: "/admin/needs-attention", roles: ["super_admin", "org_owner"], icon: "AlertTriangle" },
      { label: "Bulk Reschedule", href: "/admin/bulk-reschedule", roles: ["org_owner"], icon: "Repeat" },
      { label: "Waitlist", href: "/admin/waitlist", roles: ["super_admin", "org_owner"], icon: "ListOrdered" },
    ],
  },
  { type: "dropdown", label: "Insights", icon: "BarChart3", items: [
    { label: "Reports", href: "/admin/reports", roles: ["super_admin", "org_owner"], icon: "BarChart3" },
    { label: "Audit Log", href: "/admin/audit", roles: ["super_admin", "org_owner"], icon: "ScrollText" },
    { label: "Notification Logs", href: "/admin/templates/logs", roles: ["super_admin", "org_owner"], icon: "Mail" },
  ]},
  { type: "link", icon: "Settings", divider: true, items: [
    { label: "Settings", href: "/admin/settings", roles: ["admin", "super_admin", "org_owner"], icon: "Settings" },
  ]},
];
