"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Menu, X } from "lucide-react";
import AccountMenu from "@/components/AccountMenu";
import { NAV_CONFIG } from "@/lib/nav-config";

type AdminNavProps = {
  role?: string;
  flaggedCount?: number;
};

function LogoMark() {
  return (
    <Link href="/admin/dashboard" className="flex items-center gap-2.5 shrink-0">
      <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center">
        <span className="text-white font-bold text-sm leading-none">S</span>
      </div>
      <span className="font-semibold text-gray-900 text-sm hidden sm:inline">Scheduler</span>
    </Link>
  );
}

function Dropdown({
  label,
  items,
  badge,
  badgeCount,
  active,
}: {
  label: string;
  items: { label: string; href: string }[];
  badge?: boolean;
  badgeCount?: number;
  active: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative" onMouseLeave={() => setOpen(false)}>
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1 text-sm font-medium transition-colors ${
          active ? "text-brand-600" : "text-gray-500 hover:text-gray-700"
        }`}
      >
        {label}
        {badge && badgeCount != null && badgeCount > 0 && (
          <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-[10px] font-bold text-white leading-none">
            {badgeCount > 99 ? "99+" : badgeCount}
          </span>
        )}
        <ChevronDown
          className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 w-52 bg-white rounded-xl shadow-lg border border-gray-200 py-1.5 z-50">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminNav({ role, flaggedCount = 0 }: AdminNavProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  function matchesRole(itemRoles: string[]): boolean {
    if (!role) return false;
    return itemRoles.includes(role);
  }

  function isActive(href: string): boolean {
    if (href === "/admin/my-area") return pathname === "/admin/my-area";
    return pathname.startsWith(href);
  }

  const desktopNav = (
    <div className="hidden md:flex items-center gap-1">
      {NAV_CONFIG.map((group) => {
        if (group.type === "link") {
          return group.items
            .filter((item) => matchesRole(item.roles))
            .map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive(item.href)
                    ? "text-brand-600 bg-brand-50"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                }`}
              >
                {item.label}
              </Link>
            ));
        }

        const visibleItems = group.items.filter((item) => matchesRole(item.roles));
        if (visibleItems.length === 0) return null;

        const groupActive = visibleItems.some((item) => isActive(item.href));

        return (
          <Dropdown
            key={group.label}
            label={group.label}
            items={visibleItems}
            badge={group.badge}
            badgeCount={flaggedCount}
            active={groupActive}
          />
        );
      })}
    </div>
  );

  const mobileNav = (
    <div className="md:hidden">
      {mobileOpen && (
        <div className="absolute left-0 right-0 top-full bg-white border-b border-gray-200 shadow-lg z-50 px-4 py-3">
          {NAV_CONFIG.map((group) => {
            if (group.type === "link") {
              return (
                <div key="direct" className="space-y-1 mb-3">
                  {group.items
                    .filter((item) => matchesRole(item.roles))
                    .map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        className={`block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          isActive(item.href)
                            ? "text-brand-600 bg-brand-50"
                            : "text-gray-600 hover:bg-gray-50"
                        }`}
                      >
                        {item.label}
                      </Link>
                    ))}
                </div>
              );
            }

            const visibleItems = group.items.filter((item) => matchesRole(item.roles));
            if (visibleItems.length === 0) return null;

            return (
              <div key={group.label} className="mb-3">
                <div className="flex items-center gap-2 px-3 py-1.5">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    {group.label}
                  </span>
                  {group.badge && flaggedCount > 0 && (
                    <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-[10px] font-bold text-white leading-none">
                      {flaggedCount > 99 ? "99+" : flaggedCount}
                    </span>
                  )}
                </div>
                {visibleItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive(item.href)
                        ? "text-brand-600 bg-brand-50"
                        : "text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <nav className="relative flex items-center justify-between gap-4 mb-6 border-b border-gray-200 pb-3">
      <div className="flex items-center gap-3">
        <LogoMark />
        {desktopNav}
      </div>
      <div className="flex items-center gap-3">
        <AccountMenu />
        <button
          className="md:hidden p-1.5 rounded-lg text-gray-500 hover:bg-gray-100"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>
      {mobileNav}
    </nav>
  );
}
