import { auth } from "@/auth";

import { AnalyticsSection } from "@/components/analytics/AnalyticsSection";
import { REPORT_DEFINITIONS } from "@/lib/data/reports";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const session = await auth();
  const role = (session?.user as any)?.role;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-50">Reports</h1>
          <p className="text-sm text-gray-500 mt-1 dark:text-gray-400">Track analytics and download data extracts in CSV, Excel, or JSON format.</p>
        </div>

        <div className="mb-10">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50">Analytics</h2>
          <p className="text-sm text-gray-500 mt-1 mb-4 dark:text-gray-400">
            Track booking volume, admin utilization, and project health over time.
          </p>
          <AnalyticsSection />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {REPORT_DEFINITIONS.map((def) => (
            <div key={def.slug} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm dark:bg-gray-900 dark:border-gray-700">
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50">{def.label}</h2>
              <p className="text-sm text-gray-500 mt-1 mb-4 dark:text-gray-400">{def.description}</p>

              <div className="text-xs text-gray-400 mb-3 dark:text-gray-500">
                Columns: {def.columns.map((c) => c.label).join(", ")}
              </div>

              <div className="flex gap-2">
                <a
                  href={`/api/reports/${def.slug}?format=csv`}
                  className="bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold rounded-lg px-3 py-1.5"
                  download
                >
                  CSV
                </a>
                <a
                  href={`/api/reports/${def.slug}?format=xlsx`}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg px-3 py-1.5"
                  download
                >
                  Excel
                </a>
                <a
                  href={`/api/reports/${def.slug}?format=json`}
                  className="bg-gray-500 hover:bg-gray-600 text-white text-xs font-semibold rounded-lg px-3 py-1.5"
                  download
                >
                  JSON
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
  );
}
