"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  Menu,
  X,
  LayoutDashboard,
  FolderKanban,
  CalendarDays,
  Clock,
  Users,
  AlertTriangle,
  BarChart3,
  ScrollText,
  Mail,
  Repeat,
  ListOrdered,
  User,
  Video,
  Settings,
  type LucideIcon,
} from "lucide-react";
import AccountMenu from "@/components/AccountMenu";
import { NAV_CONFIG, type NavSection } from "@/lib/nav-config";

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard,
  FolderKanban,
  CalendarDays,
  Clock,
  Users,
  AlertTriangle,
  BarChart3,
  ScrollText,
  Mail,
  Repeat,
  ListOrdered,
  User,
  Video,
  Settings,
};

type AdminSidebarProps = {
  role?: string;
  flaggedCount?: number;
};

export default function AdminSidebar({ role, flaggedCount = 0 }: AdminSidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const matchesRole = useCallback(
    (roles: string[]) => !!role && roles.includes(role),
    [role],
  );

  const isActive = useCallback(
    (href: string) =>
      href === "/admin/my-area"
        ? pathname === "/admin/my-area"
        : pathname.startsWith(href),
    [pathname],
  );

  // Auto-expand parent groups when a child is active
  useEffect(() => {
    setExpanded((prev) => {
      const next = { ...prev };
      for (const group of NAV_CONFIG) {
        if (group.type === "dropdown" && group.items.some((i) => isActive(i.href))) {
          next[group.label] = true;
        }
      }
      return next;
    });
  }, [pathname, isActive]);

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Initialize defaultExpanded groups
  useEffect(() => {
    setExpanded((prev) => {
      const next = { ...prev };
      for (const group of NAV_CONFIG) {
        if (group.type === "dropdown" && group.defaultExpanded && prev[group.label] === undefined) {
          next[group.label] = true;
        }
      }
      return next;
    });
  }, []);

  function toggleGroup(label: string) {
    setExpanded((prev) => ({ ...prev, [label]: !prev[label] }));
  }

  function renderIcon(iconName?: string, className = "w-5 h-5") {
    if (!iconName) return null;
    const Icon = ICON_MAP[iconName];
    return Icon ? <Icon className={className} /> : null;
  }

  function renderNavContent() {
    return (
      <>
        {NAV_CONFIG.map((group) => {
          // For direct links (single-item groups like Projects, Calendar)
          if (group.type === "link") {
            const visibleItems = group.items.filter((i) => matchesRole(i.roles));
            if (visibleItems.length === 0) return null;

            return visibleItems.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? "bg-brand-50 text-brand-600 dark:bg-brand-700/40 dark:text-brand-100"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
                  }`}
                >
                  {renderIcon(item.icon)}
                  {item.label}
                </Link>
              );
            });
          }

          // Dropdown groups
          const visibleItems = group.items.filter((i) => matchesRole(i.roles));
          if (visibleItems.length === 0) return null;

          const isOpen = !!expanded[group.label];
          const groupActive = visibleItems.some((i) => isActive(i.href));
          const badgeCount =
            group.badge && flaggedCount > 0 ? flaggedCount : undefined;

          return (
            <div key={group.label} className="mb-1">
              <button
                onClick={() => toggleGroup(group.label)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  groupActive && !isOpen
                    ? "bg-brand-50 text-brand-600 dark:bg-brand-700/40 dark:text-brand-100"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
                }`}
              >
                {renderIcon(group.icon)}
                <span className="flex-1 text-left">{group.label}</span>
                {badgeCount != null && (
                  <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-[10px] font-bold text-white leading-none">
                    {badgeCount > 99 ? "99+" : badgeCount}
                  </span>
                )}
                <ChevronDown
                  className={`w-4 h-4 text-gray-400 transition-transform dark:text-gray-500 ${
                    isOpen ? "rotate-180" : ""
                  }`}
                />
              </button>
                {isOpen && (
                  <div className="ml-4 mt-0.5 space-y-0.5 border-l border-gray-200 pl-3 dark:border-gray-700">
                    {visibleItems.map((item) => {
                      const active = isActive(item.href);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                            active
                              ? "bg-brand-50 text-brand-600 font-medium dark:bg-brand-700/40 dark:text-brand-100"
                              : "text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                          }`}
                        >
                          {renderIcon(item.icon, "w-4 h-4")}
                          {item.label}
                          {item.label === "Needs Attention" && badgeCount != null && (
                            <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-[10px] font-bold text-white leading-none ml-auto">
                              {badgeCount > 99 ? "99+" : badgeCount}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                )}
            </div>
          );
        })}
      </>
    );
  }

  return (
    <>
      {/* Mobile hamburger button */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 dark:bg-gray-900 dark:border-gray-700">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
        >
          <Menu className="w-5 h-5" />
        </button>
        <span className="font-semibold text-gray-900 text-sm dark:text-gray-50">Scheduler</span>
      </div>

      {/* Mobile overlay — wrapper ensures sidebar is always ABOVE backdrop */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-64 bg-white shadow-xl flex flex-col dark:bg-gray-900">
            <div className="px-4 py-4 border-b border-gray-200 flex items-center justify-between dark:border-gray-700">
              <Link href="/admin/dashboard" className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center">
                  <span className="text-white font-bold text-sm leading-none">S</span>
                </div>
                <span className="font-semibold text-gray-900 text-sm dark:text-gray-50">Scheduler</span>
              </Link>
              <button
                onClick={() => setMobileOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:text-gray-500 dark:hover:bg-gray-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
              {renderNavContent()}
            </nav>
            <div className="border-t border-gray-200 p-3 dark:border-gray-700">
              <AccountMenu />
            </div>
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:w-60 lg:flex-col bg-white border-r border-gray-200 dark:bg-gray-900 dark:border-gray-700">
        <div className="px-4 py-5 border-b border-gray-100 dark:border-gray-800">
          <Link href="/admin/dashboard" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center">
              <span className="text-white font-bold text-sm leading-none">S</span>
            </div>
            <span className="font-semibold text-gray-900 text-sm dark:text-gray-50">Scheduler</span>
          </Link>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
          {renderNavContent()}
        </nav>
        <div className="border-t border-gray-200 p-3 dark:border-gray-700">
          <AccountMenu />
        </div>
      </div>
    </>
  );
}
