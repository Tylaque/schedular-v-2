import Link from "next/link";
import { PROJECTS } from "@/lib/mockData";

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <h1 className="text-xl font-bold text-gray-900 mb-2">Scheduling Platform — Dev Preview</h1>
        <p className="text-sm text-gray-500 mb-6">
          This is a mock-data preview of the participant booking flow. Real slot data,
          Admin availability, and Microsoft Graph integration come in later phases.
        </p>
        <div className="flex flex-col gap-2">
          {Object.values(PROJECTS).map((p) => (
            <Link
              key={p.slug}
              href={`/book/${p.slug}`}
              className="border border-gray-200 rounded-lg px-4 py-3 text-sm font-medium text-brand-600 hover:bg-brand-50"
            >
              {p.name} →
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
