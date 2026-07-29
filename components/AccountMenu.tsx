"use client";

import { useState, useRef, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { LogOut, ChevronDown } from "lucide-react";

const ROLE_BADGE: Record<string, string> = {
  admin: "bg-gray-100 text-gray-600",
  super_admin: "bg-blue-100 text-blue-700",
  org_owner: "bg-purple-100 text-purple-700",
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export default function AccountMenu() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ bottom: number; right: number } | null>(null);

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
      setPos({ bottom: window.innerHeight - rect.top, right: window.innerWidth - rect.right });
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
        className="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900 transition-colors"
      >
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-200 text-xs font-bold text-gray-600">
          {getInitials(name)}
        </span>
        <span className="hidden sm:inline font-medium">{name}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && pos && (
        <div
          ref={panelRef}
          className="fixed z-[100] w-64 bg-white rounded-xl shadow-lg border border-gray-200 py-3"
          style={{ bottom: pos.bottom, right: pos.right }}
        >
          <div className="px-4 pb-3 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-900">{name}</p>
            <p className="text-xs text-gray-500 mt-0.5">{email}</p>
            <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium mt-2 ${ROLE_BADGE[role] ?? "bg-gray-100 text-gray-600"}`}>
              {role}
            </span>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
