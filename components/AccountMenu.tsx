"use client";

import { useState, useRef, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { LogOut, ChevronDown } from "lucide-react";
import Avatar from "@/components/Avatar";
import ThemeToggle from "@/components/ThemeToggle";

const ROLE_BADGE: Record<string, string> = {
  admin: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
  super_admin: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  org_owner: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
};

export default function AccountMenu() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ bottom: number; left: number } | null>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        btnRef.current &&
        !btnRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Recalculate position when opening
  useEffect(() => {
    if (open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({ bottom: window.innerHeight - rect.top, left: rect.right + 8 });
    } else {
      setPos(null);
    }
  }, [open]);

  if (!session?.user) return null;

  const name = session.user.name ?? "User";
  const email = session.user.email ?? "";
  const role = (session.user as any).role ?? "admin";

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900 transition-colors dark:text-gray-300 dark:hover:text-gray-100"
      >
        <Avatar name={name} seed={email} />
        <span className="hidden sm:inline font-medium">{name}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform dark:text-gray-500 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && pos && (
        <div
          ref={panelRef}
          className="fixed z-[100] w-64 bg-white rounded-xl shadow-lg border border-gray-200 py-3 dark:bg-gray-900 dark:border-gray-700"
          style={{ bottom: pos.bottom, left: pos.left }}
        >
          <div className="px-4 pb-3 border-b border-gray-100 dark:border-gray-800">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-50">{name}</p>
            <p className="text-xs text-gray-500 mt-0.5 dark:text-gray-400">{email}</p>
            <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium mt-2 ${ROLE_BADGE[role] ?? "bg-gray-100 text-gray-600"}`}>
              {role}
            </span>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
          <div className="flex items-center justify-between px-4 py-2.5 mt-1 border-t border-gray-100 dark:border-gray-800">
            <span className="text-sm text-gray-600 dark:text-gray-400">Theme</span>
            <ThemeToggle />
          </div>
        </div>
      )}
    </div>
  );
}
