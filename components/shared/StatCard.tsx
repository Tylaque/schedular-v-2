import type { ReactNode } from "react";
import { designTokens } from "@/lib/design-tokens";

// Shared stat card for the redesigned Dashboard. Renders the same card
// surface as the Projects screen (`.project-card` class + --dt-* custom
// properties injected by the screen's dtScreenVars()), so dark mode works
// through the app's `.dark` class without JS-side color selection.
export default function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon?: ReactNode;
  label: string;
  value: ReactNode;
  sub?: string;
}) {
  return (
    <div className="project-card">
      <div
        className="dt-text-secondary"
        style={{
          display: "flex",
          alignItems: "center",
          gap: designTokens.spacing.chipGap,
          fontSize: designTokens.type.overline.size,
          fontWeight: designTokens.type.overline.weight,
          letterSpacing: designTokens.type.overline.letterSpacing,
          textTransform: "uppercase",
        }}
      >
        {icon}
        <span style={{ lineHeight: 1.3 }}>{label}</span>
      </div>
      <div
        className="dt-text-primary"
        style={{
          fontSize: 28,
          fontWeight: 700,
          lineHeight: 1.2,
          marginTop: designTokens.spacing.chipGap,
        }}
      >
        {value}
      </div>
      {sub && (
        <div
          className="dt-text-muted"
          style={{
            fontSize: designTokens.type.caption.size,
            marginTop: 4,
          }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}
