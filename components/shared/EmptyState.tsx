"use client";

import type { LucideIcon } from "lucide-react";
import { designTokens, cardTitleStyle, bodyTextStyle } from "@/lib/design-tokens";

// Shared empty-state block for the redesigned screens (calendar, team).
// Surface + text are token-driven, so it renders correctly in light and
// dark wherever it is mounted inside a screen that injects dtScreenVars().
export default function EmptyState({
  icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  const Icon = icon;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: designTokens.spacing.chipGap,
        padding: "56px 0",
        textAlign: "center",
      }}
    >
      <div
        className="dt-chip"
        style={{
          width: 56,
          height: 56,
          borderRadius: designTokens.radius.icon,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon style={{ width: 24, height: 24, color: designTokens.color.text.muted }} />
      </div>
      <p className="dt-text-primary" style={cardTitleStyle}>{title}</p>
      <p className="dt-text-muted" style={bodyTextStyle}>{description}</p>
    </div>
  );
}
