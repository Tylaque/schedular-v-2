import type { CSSProperties } from "react";
import { designTokens } from "@/lib/design-tokens";

export type PlatformKey = "zoom" | "teams";

// Shared platform-connectivity chip. First built for the Projects screen
// (Phase 1), now extracted so the Dashboard reuses the exact same chip.
// Styling comes from lib/design-tokens.ts + the .dt-chip/.dt-text-* rules
// in globals.css (dark mode included), so it renders identically wherever
// it is mounted inside a screen that injects dtScreenVars().
export function PlatformChip({
  label,
  connected,
  platform,
  showStatus = true,
}: {
  label: string;
  connected: boolean;
  platform: PlatformKey;
  showStatus?: boolean;
}) {
  const caption: CSSProperties = {
    fontSize: designTokens.type.caption.size,
    fontWeight: designTokens.type.caption.weight,
    lineHeight: 1,
  };
  return (
    <span
      className="dt-chip dt-text-secondary"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        borderRadius: designTokens.radius.chip,
        ...caption,
        padding: "4px 10px",
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: 999,
          backgroundColor: connected
            ? designTokens.color.platform[platform]
            : designTokens.color.platform.off,
        }}
      />
      {label}
      {showStatus && (
        <span
          className="dt-text-muted"
          style={{
            ...caption,
            color: connected ? designTokens.color.platform[platform] : undefined,
          }}
        >
          {connected ? "Connected" : "Not connected"}
        </span>
      )}
    </span>
  );
}
