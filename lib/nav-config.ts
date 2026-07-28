export type NavItem = {
  label: string;
  href: string;
  roles: string[];
};

export type NavLink = { type: "link"; items: NavItem[] };
export type NavDropdown = { type: "dropdown"; label: string; badge?: boolean; items: NavItem[] };
export type NavGroup = NavLink | NavDropdown;

export const NAV_CONFIG: NavGroup[] = [
  {
    type: "link",
    items: [
      { label: "My Area", href: "/admin/my-area", roles: ["admin", "super_admin", "org_owner"] },
      { label: "Dashboard", href: "/admin/dashboard", roles: ["org_owner"] },
      { label: "My Dashboard", href: "/admin/my-dashboard", roles: ["super_admin", "org_owner"] },
      { label: "Projects", href: "/admin/projects", roles: ["super_admin", "org_owner"] },
      { label: "Calendar", href: "/admin/calendar", roles: ["super_admin", "org_owner"] },
    ],
  },
  {
    type: "dropdown",
    label: "Availability",
    items: [
      { label: "My Availability", href: "/admin/my-availability", roles: ["admin", "super_admin", "org_owner"] },
    ],
  },
  {
    type: "dropdown",
    label: "Manage",
    items: [
      { label: "Team", href: "/admin/team", roles: ["org_owner"] },
      { label: "Templates", href: "/admin/templates", roles: ["super_admin", "org_owner"] },
    ],
  },
  {
    type: "dropdown",
    label: "Operations",
    badge: true,
    items: [
      { label: "Needs Attention", href: "/admin/needs-attention", roles: ["super_admin", "org_owner"] },
      { label: "Bulk Reschedule", href: "/admin/bulk-reschedule", roles: ["org_owner"] },
      { label: "Waitlist", href: "/admin/waitlist", roles: ["super_admin", "org_owner"] },
    ],
  },
  {
    type: "dropdown",
    label: "Insights",
    items: [
      { label: "Reports", href: "/admin/reports", roles: ["super_admin", "org_owner"] },
      { label: "Audit Log", href: "/admin/audit", roles: ["super_admin", "org_owner"] },
      { label: "Notification Logs", href: "/admin/templates/logs", roles: ["super_admin", "org_owner"] },
    ],
  },
];
