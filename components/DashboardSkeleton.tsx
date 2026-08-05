import { designTokens, dtScreenVars } from "@/lib/design-tokens";

function Bar({ width, height = 14 }: { width: number; height?: number }) {
  return <div className="dt-skeleton" style={{ width, height }} />;
}

export default function DashboardSkeleton() {
  return (
    <div className="max-w-5xl mx-auto p-6" style={dtScreenVars()}>
      <Bar width={180} height={26} />
      <div style={{ marginTop: 8 }}>
        <Bar width={260} height={14} />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: designTokens.spacing.cardGap,
          marginTop: designTokens.spacing.section + 8,
        }}
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="project-card">
            <Bar width={110} height={12} />
            <div style={{ marginTop: designTokens.spacing.chipGap }}>
              <Bar width={60} height={28} />
            </div>
          </div>
        ))}
      </div>

      <div className="project-card" style={{ marginTop: designTokens.spacing.section + 8 }}>
        <Bar width={160} height={16} />
        <div style={{ marginTop: designTokens.spacing.section }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: designTokens.spacing.section,
                padding: `${designTokens.spacing.control}px 0`,
              }}
            >
              <div>
                <Bar width={140} height={14} />
                <div style={{ marginTop: 6 }}>
                  <Bar width={100} height={12} />
                </div>
              </div>
              <Bar width={90} height={24} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
