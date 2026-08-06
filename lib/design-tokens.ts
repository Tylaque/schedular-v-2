// Design tokens — single source of truth for the UI redesign.
//
// Derived from the EXISTING landing page (app/page.tsx), which is the
// approved brand baseline:
//   - bold, tight-tracking headline + relaxed body type
//   - indigo/purple primary (#4338CA brand-500), neutral grays, generous
//     white space
//   - generous card corner-radius and padding (the old Projects table was
//     denser than the landing page — this closes that gap)
//
// Color is used ONLY as functional accent (status badges, platform
// indicators for Zoom/Teams connection, availability states) — never as
// decorative color blocking.
//
// Every component touched by the redesign imports these tokens; no
// hardcoded colors/spacing/radii/type in the redesigned screens.

import type { CSSProperties } from "react";

export const designTokens = {
  color: {
    // Brand primary — matches the landing page's `brand-500` (#4338CA).
    // NOTE: the brief approximated the primary as ~#4F46E5, but the actual
    // landing page renders #4338CA (indigo-700 scale), so that is kept.
    brand: {
      50: "#EEF1FD",
      100: "#DCE1FB",
      500: "#4338CA",
      600: "#3730A9",
      700: "#2E2789",
      // Interactive brand states (selected cells, active segments). The
      // `on` color is used on top of brand-500 fills; `tint`/`tintDark`
      // and `textDark` give the tinted surface a readable dark-mode pair.
      on: "#FFFFFF",
      textDark: "#C7D2FE",
      tintDark: "rgba(99, 102, 241, 0.16)",
    },
    // Surfaces & neutrals (from globals.css + landing page grays).
    surface: {
      page: "#F7F8FA",
      card: "#FFFFFF",
      cardHover: "#FAFAFC",
      overlay: "rgba(20, 22, 26, 0.04)",
    },
    text: {
      primary: "#14161A",
      secondary: "#6B7280",
      muted: "#9CA3AF",
      inverse: "#FFFFFF",
    },
    border: {
      subtle: "#E5E7EB",
      strong: "#D1D5DB",
    },
    // Functional status accents (emerald/amber/red/neutral).
    status: {
      active: { bg: "#D1FAE5", text: "#065F46", dot: "#059669" },
      paused: { bg: "#FEF3C7", text: "#92400E", dot: "#D97706" },
      closed: { bg: "#FEE2E2", text: "#991B1B", dot: "#DC2626" },
      draft: { bg: "#F3F4F6", text: "#4B5563", dot: "#6B7280" },
      archived: { bg: "#F3F4F6", text: "#6B7280", dot: "#9CA3AF" },
      // Participant/booking states (My Dashboard). Reuses the accent above
      // where the semantics overlap; blue/purple added for the states that
      // have no neutral/emerald/amber/red equivalent.
      invited: { bg: "#F3F4F6", text: "#4B5563", dot: "#6B7280" },
      link_sent: { bg: "#FEF3C7", text: "#92400E", dot: "#D97706" },
      booked: { bg: "#DBEAFE", text: "#1D4ED8", dot: "#2563EB" },
      reminded: { bg: "#EDE9FE", text: "#6D28D9", dot: "#7C3AED" },
      completed: { bg: "#D1FAE5", text: "#065F46", dot: "#059669" },
      no_show: { bg: "#FEE2E2", text: "#991B1B", dot: "#DC2626" },
      cancelled: { bg: "#F3F4F6", text: "#6B7280", dot: "#9CA3AF" },
    },
    // Platform indicators (functional identity color per platform;
    // connectivity is expressed via the same dot turning neutral when off).
    platform: {
      zoom: "#2D8CFF",
      teams: "#6264A7",
      off: "#D1D5DB",
    },
    // Role identity accents (Team screen) — same visual language as the
    // status accents (gray/blue/purple), fed through the same chip helpers.
    role: {
      admin: { bg: "#F3F4F6", text: "#4B5563", dot: "#6B7280" },
      super_admin: { bg: "#DBEAFE", text: "#1D4ED8", dot: "#2563EB" },
      org_owner: { bg: "#EDE9FE", text: "#6D28D9", dot: "#7C3AED" },
    },
    // Destructive + success action colors (Team screen: deactivate/
    // reactivate, modal confirmations, result banners).
    danger: {
      base: "#DC2626",
      hover: "#B91C1C",
      on: "#FFFFFF",
      text: "#B91C1C",
      textDark: "#FCA5A5",
    },
    ok: {
      text: "#065F46",
      textDark: "#6EE7B7",
    },
    promote: {
      text: "#6D28D9",
      textDark: "#C4B5FD",
    },
  },

  // Spacing (px) — generous, matching the landing page's padding rhythm.
  spacing: {
    page: 24,
    card: 20,
    cardGap: 12,
    section: 16,
    chipGap: 8,
    control: 8,
  },

  // Corner radius (px) — generous cards, landing-style controls.
  radius: {
    card: 16,
    icon: 12,
    control: 8,
    chip: 999,
  },

  // Typography — landing headline (bold, tight tracking) + relaxed body.
  type: {
    pageTitle: { size: 24, weight: 700, lineHeight: 1.25, letterSpacing: "-0.02em" },
    cardTitle: { size: 16, weight: 600, lineHeight: 1.3, letterSpacing: "-0.01em" },
    body: { size: 14, weight: 400, lineHeight: 1.5, letterSpacing: "0" },
    meta: { size: 13, weight: 500, lineHeight: 1.4, letterSpacing: "0" },
    caption: { size: 12, weight: 500, lineHeight: 1.4, letterSpacing: "0" },
    overline: { size: 11, weight: 600, lineHeight: 1.3, letterSpacing: "0.05em" },
  },

  // Elevation + motion.
  shadow: {
    card: "0 1px 3px rgba(20, 22, 26, 0.06)",
    cardHover: "0 8px 24px rgba(20, 22, 26, 0.09)",
    focusRing: "0 0 0 3px rgba(67, 56, 202, 0.25)",
  },
  motion: {
    fast: "150ms ease-out",
  },
  borderWidth: {
    card: 1,
  },
} as const;

// Dark-mode palette for the redesigned screens. The app's dark mode is a
// `.dark` class on <html> (components/ThemeProvider.tsx toggles it; the
// rest of the app styles with Tailwind `dark:` variants off that class).
// The redesigned screens are class-driven too: components inject these
// `--dt-*-dark` custom properties alongside the light ones, and globals.css
// re-points the active properties under `.dark` (see the :19/:24-style
// override block). Values match the app's existing dark grays (gray-900
// cards, gray-950 page, gray-700/800 borders, gray-200/300/400 text).
export const darkTokens = {
  surface: {
    page: "#030712",
    card: "#111827",
    cardHover: "#1F2937",
    overlay: "rgba(255, 255, 255, 0.07)",
  },
  text: {
    primary: "#E5E7EB",
    secondary: "#D1D5DB",
    muted: "#9CA3AF",
    inverse: "#FFFFFF",
  },
  border: {
    subtle: "#1F2937",
    strong: "#374151",
  },
  chip: {
    bg: "#1F2937",
    border: "#374151",
  },
  pill: {
    bg: "#1F2937",
    text: "#D1D5DB",
  },
  link: "#A5B4FC",
  skeleton: "rgba(255, 255, 255, 0.07)",
} as const;

// Full set of custom properties a redesigned screen injects on its root
// container (inline). globals.css consumes them through the .dt-*,
// .project-card and .dark rules; light and dark values both come from the
// tokens above, so no color is hardcoded in CSS or components.
export function dtScreenVars(): CSSProperties {
  return {
    "--dt-card-bg": designTokens.color.surface.card,
    "--dt-card-bg-dark": darkTokens.surface.card,
    "--dt-card-bg-hover": designTokens.color.surface.cardHover,
    "--dt-card-bg-hover-dark": darkTokens.surface.cardHover,
    "--dt-card-border": designTokens.color.border.subtle,
    "--dt-card-border-dark": darkTokens.border.subtle,
    "--dt-card-border-hover": designTokens.color.brand[100],
    "--dt-card-border-hover-dark": darkTokens.border.strong,
    "--dt-text-primary": designTokens.color.text.primary,
    "--dt-text-primary-dark": darkTokens.text.primary,
    "--dt-text-secondary": designTokens.color.text.secondary,
    "--dt-text-secondary-dark": darkTokens.text.secondary,
    "--dt-text-muted": designTokens.color.text.muted,
    "--dt-text-muted-dark": darkTokens.text.muted,
    "--dt-control-bg": designTokens.color.surface.card,
    "--dt-control-bg-dark": darkTokens.surface.card,
    "--dt-control-border": designTokens.color.border.subtle,
    "--dt-control-border-dark": darkTokens.border.subtle,
    "--dt-chip-bg": designTokens.color.surface.card,
    "--dt-chip-bg-dark": darkTokens.chip.bg,
    "--dt-chip-border": designTokens.color.border.subtle,
    "--dt-chip-border-dark": darkTokens.chip.border,
    "--dt-pill-bg": designTokens.color.status.draft.bg,
    "--dt-pill-bg-dark": darkTokens.pill.bg,
    "--dt-pill-text": designTokens.color.status.draft.text,
    "--dt-pill-text-dark": darkTokens.pill.text,
    "--dt-link": designTokens.color.brand[500],
    "--dt-link-dark": darkTokens.link,
    "--dt-skeleton-bg": designTokens.color.surface.overlay,
    "--dt-skeleton-bg-dark": darkTokens.skeleton,
    "--dt-brand": designTokens.color.brand[500],
    "--dt-brand-hover": designTokens.color.brand[600],
    "--dt-brand-on": designTokens.color.brand.on,
    "--dt-brand-tint": designTokens.color.brand[50],
    "--dt-brand-tint-dark": designTokens.color.brand.tintDark,
    "--dt-brand-text": designTokens.color.brand[700],
    "--dt-brand-text-dark": designTokens.color.brand.textDark,
    "--dt-brand-border": designTokens.color.brand[100],
    "--dt-brand-border-dark": designTokens.color.brand.tintDark,
    "--dt-danger": designTokens.color.danger.base,
    "--dt-danger-hover": designTokens.color.danger.hover,
    "--dt-danger-on": designTokens.color.danger.on,
    "--dt-danger-text": designTokens.color.danger.text,
    "--dt-danger-text-dark": designTokens.color.danger.textDark,
    "--dt-ok-text": designTokens.color.ok.text,
    "--dt-ok-text-dark": designTokens.color.ok.textDark,
    "--dt-promote-text": designTokens.color.promote.text,
    "--dt-promote-text-dark": designTokens.color.promote.textDark,
    "--dt-card-radius": `${designTokens.radius.card}px`,
    "--dt-card-padding": `${designTokens.spacing.card}px`,
    "--dt-card-shadow": designTokens.shadow.card,
    "--dt-card-shadow-hover": designTokens.shadow.cardHover,
    "--dt-focus-ring": designTokens.shadow.focusRing,
    "--dt-motion": designTokens.motion.fast,
  } as unknown as CSSProperties;
}

// ---- Derived style presets (all reference the tokens above) ----

export const cardSurface: CSSProperties = {
  backgroundColor: designTokens.color.surface.card,
  border: `${designTokens.borderWidth.card}px solid ${designTokens.color.border.subtle}`,
  borderRadius: designTokens.radius.card,
  boxShadow: designTokens.shadow.card,
  padding: designTokens.spacing.card,
  transition: `box-shadow ${designTokens.motion.fast}, border-color ${designTokens.motion.fast}, background-color ${designTokens.motion.fast}`,
};

export const cardSurfaceHover: CSSProperties = {
  ...cardSurface,
  backgroundColor: designTokens.color.surface.cardHover,
  borderColor: designTokens.color.brand[100],
  boxShadow: designTokens.shadow.cardHover,
};

export const focusRing: CSSProperties = {
  outline: "none",
  boxShadow: designTokens.shadow.focusRing,
};

export const pageTitleStyle: CSSProperties = {
  fontSize: designTokens.type.pageTitle.size,
  fontWeight: designTokens.type.pageTitle.weight,
  lineHeight: designTokens.type.pageTitle.lineHeight,
  letterSpacing: designTokens.type.pageTitle.letterSpacing,
  color: designTokens.color.text.primary,
};

export const avatarTile: CSSProperties = {
  width: 48,
  height: 48,
  borderRadius: designTokens.radius.icon,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: designTokens.color.text.inverse,
  fontSize: designTokens.type.cardTitle.size,
  fontWeight: designTokens.type.cardTitle.weight,
  flexShrink: 0,
  userSelect: "none",
};

type ChipPalette = Record<string, { bg: string; text: string; dot: string }>;

function chipFor(palette: ChipPalette, key: string): CSSProperties {
  const s = palette[key] ?? designTokens.color.status.draft;
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    borderRadius: designTokens.radius.chip,
    backgroundColor: s.bg,
    color: s.text,
    fontSize: designTokens.type.caption.size,
    fontWeight: designTokens.type.caption.weight,
    lineHeight: 1,
    padding: "4px 10px",
    whiteSpace: "nowrap",
  };
}

function dotFor(palette: ChipPalette, key: string): CSSProperties {
  const s = palette[key] ?? designTokens.color.status.draft;
  return {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: s.dot,
  };
}

export const statusChip = (status: string): CSSProperties => chipFor(designTokens.color.status, status);
export const statusDot = (status: string): CSSProperties => dotFor(designTokens.color.status, status);
export const roleChip = (role: string): CSSProperties => chipFor(designTokens.color.role, role);
export const roleDot = (role: string): CSSProperties => dotFor(designTokens.color.role, role);

export const platformChip = (connected: boolean, platformKey: "zoom" | "teams"): CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  borderRadius: designTokens.radius.chip,
  border: `${designTokens.borderWidth.card}px solid ${designTokens.color.border.subtle}`,
  backgroundColor: designTokens.color.surface.card,
  color: designTokens.color.text.secondary,
  fontSize: designTokens.type.caption.size,
  fontWeight: designTokens.type.caption.weight,
  lineHeight: 1,
  padding: "4px 10px",
  whiteSpace: "nowrap",
});

export const platformDot = (connected: boolean, platformKey: "zoom" | "teams"): CSSProperties => ({
  width: 6,
  height: 6,
  borderRadius: 999,
  backgroundColor: connected
    ? designTokens.color.platform[platformKey]
    : designTokens.color.platform.off,
});

export const primaryButton: CSSProperties = {
  backgroundColor: designTokens.color.brand[500],
  color: designTokens.color.text.inverse,
  fontSize: designTokens.type.body.size,
  fontWeight: designTokens.type.meta.weight,
  lineHeight: 1,
  borderRadius: designTokens.radius.control,
  padding: "10px 16px",
  border: "none",
  cursor: "pointer",
  transition: `background-color ${designTokens.motion.fast}`,
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
};

export const primaryButtonHover: CSSProperties = {
  backgroundColor: designTokens.color.brand[600],
};

export const editLink: CSSProperties = {
  color: designTokens.color.brand[500],
  fontSize: designTokens.type.meta.size,
  fontWeight: designTokens.type.meta.weight,
  textDecoration: "none",
  borderRadius: designTokens.radius.control,
  padding: "6px 10px",
  transition: `background-color ${designTokens.motion.fast}, color ${designTokens.motion.fast}`,
};

export const editLinkHover: CSSProperties = {
  backgroundColor: designTokens.color.brand[50],
  color: designTokens.color.brand[700],
};

export const cardTitleStyle: CSSProperties = {
  fontSize: designTokens.type.cardTitle.size,
  fontWeight: designTokens.type.cardTitle.weight,
  lineHeight: designTokens.type.cardTitle.lineHeight,
  letterSpacing: designTokens.type.cardTitle.letterSpacing,
  color: designTokens.color.text.primary,
};

export const bodyTextStyle: CSSProperties = {
  fontSize: designTokens.type.body.size,
  fontWeight: designTokens.type.body.weight,
  lineHeight: designTokens.type.body.lineHeight,
  letterSpacing: designTokens.type.body.letterSpacing,
  color: designTokens.color.text.secondary,
};

export const metaTextStyle: CSSProperties = {
  fontSize: designTokens.type.meta.size,
  fontWeight: designTokens.type.meta.weight,
  lineHeight: designTokens.type.meta.lineHeight,
  letterSpacing: designTokens.type.meta.letterSpacing,
  color: designTokens.color.text.secondary,
};

export const pageSubtitleStyle: CSSProperties = {
  fontSize: designTokens.type.body.size,
  lineHeight: designTokens.type.body.lineHeight,
  color: designTokens.color.text.secondary,
};

export const skeletonBlock: CSSProperties = {
  backgroundColor: designTokens.color.surface.overlay,
  borderRadius: designTokens.radius.control,
  animation: "designSkeletonPulse 1.6s ease-in-out infinite",
};
