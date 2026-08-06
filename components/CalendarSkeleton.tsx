"use client";

import { designTokens, dtScreenVars } from "@/lib/design-tokens";

function Bar({ width, height, radius }: { width: number | string; height: number; radius?: number }) {
  return (
    <div
      className="dt-skeleton"
      style={{ width, height, borderRadius: radius ?? designTokens.radius.control }}
    />
  );
}

// Skeleton for the calendar card. Mirrors the real layout (toolbar,
// filters, weekday header, day grid) so the transition to real content
// does not jump. Uses the shared .dt-skeleton token block for both themes.
export default function CalendarSkeleton() {
  return (
    <div style={dtScreenVars()}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <Bar width={180} height={34} />
        <Bar width={150} height={34} />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16 }}>
        <Bar width={160} height={36} />
        <Bar width={160} height={36} />
        <Bar width={220} height={36} />
        <Bar width={150} height={36} />
      </div>

      <div className="grid grid-cols-7" style={{ gap: 4, marginTop: 16 }}>
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "center", paddingBottom: 8 }}>
            <Bar width={18} height={11} />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7" style={{ gap: 4 }}>
        {Array.from({ length: 35 }).map((_, i) => (
          <div key={i} className="dt-skeleton" style={{ aspectRatio: "1", borderRadius: designTokens.radius.control }} />
        ))}
      </div>
    </div>
  );
}
