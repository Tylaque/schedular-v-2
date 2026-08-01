"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { signOut } from "next-auth/react";
import { Clock } from "lucide-react";
const WARNING_MS = Number(process.env.NEXT_PUBLIC_SESSION_WARNING_MS ?? "") || 13 * 60 * 1000;

const TIMEOUT_MS = Number(process.env.NEXT_PUBLIC_SESSION_TIMEOUT_MS ?? "") || 15 * 60 * 1000;

export default function SessionTimeout() {
  const [showWarning, setShowWarning] = useState(false);
  const warningTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (warningTimer.current) clearTimeout(warningTimer.current);
    if (logoutTimer.current) clearTimeout(logoutTimer.current);
    warningTimer.current = null;
    logoutTimer.current = null;
  }, []);

  const reset = useCallback(() => {
    setShowWarning(false);
    clearTimers();
    warningTimer.current = setTimeout(() => setShowWarning(true), WARNING_MS);
    logoutTimer.current = setTimeout(() => signOut({ callbackUrl: "/" }), TIMEOUT_MS);
  }, [clearTimers]);

  useEffect(() => {
    reset();
    return clearTimers;
  }, [reset, clearTimers]);

  useEffect(() => {
    const events = ["mousemove", "mousedown", "keydown", "click", "scroll", "wheel", "touchstart"];
    const onActivity = () => reset();
    for (const e of events) window.addEventListener(e, onActivity, { passive: true });
    return () => {
      for (const e of events) window.removeEventListener(e, onActivity);
    };
  }, [reset]);

  if (!showWarning) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4" onClick={reset}>
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-2">
          <Clock className="w-5 h-5 text-amber-500" />
          <h2 className="text-base font-bold text-gray-900">Still there?</h2>
        </div>
        <p className="text-sm text-gray-600 mb-5">
          You&apos;ll be signed out in 2 minutes due to inactivity. Click anywhere or press a key to stay signed in.
        </p>
        <button
          onClick={reset}
          className="w-full bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg px-4 py-2.5 transition-colors"
        >
          Stay signed in
        </button>
      </div>
    </div>
  );
}
