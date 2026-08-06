import { designTokens, dtScreenVars } from "@/lib/design-tokens";

function Bar({ width, height, radius }: { width: number | string; height: number; radius?: number }) {
  return (
    <div
      className="dt-skeleton"
      style={{ width, height, borderRadius: radius ?? designTokens.radius.control }}
    />
  );
}

// Skeleton for the Team screen (route transition shell). Mirrors the layout:
// page title, search bar, invite action, table of rows.
export default function TeamLoading() {
  return (
    <div className="max-w-5xl mx-auto p-6" style={dtScreenVars()}>
      <Bar width={220} height={26} />
      <div style={{ marginTop: 8 }}>
        <Bar width={280} height={14} />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 20 }}>
        <Bar width={300} height={38} />
        <Bar width={140} height={38} />
      </div>

      <div className="project-card project-card-static" style={{ marginTop: 16 }}>
        <Bar width={120} height={36} />
      </div>

      <div className="project-card project-card-static" style={{ marginTop: 16 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: designTokens.spacing.section,
              padding: "14px 0",
              borderBottom: i < 5 ? "1px solid var(--dt-card-border)" : undefined,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Bar width={28} height={28} radius={designTokens.radius.icon} />
              <div>
                <Bar width={140} height={14} />
                <div style={{ marginTop: 6 }}>
                  <Bar width={110} height={12} />
                </div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Bar width={80} height={22} />
              <Bar width={80} height={22} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
