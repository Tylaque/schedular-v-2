// Loading skeleton for the Projects screen. Mirrors the card shape of the
// redesigned ProjectsClient (avatar tile + title + metadata bars) so the
// loading state matches the final layout. Cards reuse the `.project-card`
// class and bars the `.dt-skeleton` class, so dark mode (the app's `.dark`
// class, overridden in globals.css) works without JS-side color selection.
// All values come from lib/design-tokens.ts via dtScreenVars().

import { designTokens, dtScreenVars } from "@/lib/design-tokens";

function Bar({ width, height = 14 }: { width: number; height?: number }) {
  return <div className="dt-skeleton" style={{ width, height }} />;
}

export default function ProjectCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="max-w-5xl mx-auto p-6" style={dtScreenVars()}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: designTokens.spacing.section,
          marginBottom: designTokens.spacing.section + 8,
        }}
      >
        <div>
          <Bar width={150} height={26} />
          <div style={{ marginTop: 8 }}>
            <Bar width={220} height={14} />
          </div>
        </div>
        <Bar width={110} height={38} />
      </div>

      <div style={{ display: "grid", gap: designTokens.spacing.cardGap }}>
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="project-card"
            style={{ display: "flex", alignItems: "flex-start", gap: designTokens.spacing.section }}
          >
            <div
              className="dt-skeleton"
              style={{
                width: 48,
                height: 48,
                borderRadius: designTokens.radius.icon,
                flexShrink: 0,
              }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <Bar width={190} height={18} />
              <div style={{ marginTop: designTokens.spacing.chipGap }}>
                <Bar width={130} height={12} />
              </div>
              <div style={{ marginTop: designTokens.spacing.section }}>
                <Bar width={280} height={12} />
              </div>
              <div style={{ marginTop: designTokens.spacing.cardGap }}>
                <Bar width={200} height={12} />
              </div>
            </div>
            <Bar width={56} height={28} />
          </div>
        ))}
      </div>
    </div>
  );
}
