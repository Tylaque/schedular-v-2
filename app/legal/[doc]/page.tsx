import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";

const DOCS: Record<string, string> = {
  "privacy-notice": "Privacy Notice",
  "customer-terms": "Customer Terms",
  "participant-terms": "Participant Terms",
  "acceptable-use-policy": "Acceptable Use Policy",
  "data-processing-addendum": "Data Processing Addendum",
};

export function generateStaticParams() {
  return Object.keys(DOCS).map((doc) => ({ doc }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ doc: string }>;
}): Promise<Metadata> {
  const { doc } = await params;
  const title = DOCS[doc];
  if (!title) return { title: "Not found" };
  return {
    title: `${title} — Eureka`,
    description: `${title} — draft, not legal advice`,
  };
}

export default async function LegalDocPage({
  params,
}: {
  params: Promise<{ doc: string }>;
}) {
  const { doc } = await params;
  const title = DOCS[doc];
  if (!title) notFound();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <header className="border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-accent-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm leading-none">E</span>
            </div>
            <span className="font-semibold text-gray-900 dark:text-gray-50">Eureka</span>
          </Link>
          <nav className="flex items-center gap-4">
            <ThemeToggle />
            <Link
              href="/auth/signin"
              className="text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
            >
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Eureka
        </Link>

        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-50 mt-6">
          {title}
        </h1>

        <div className="mt-6 border border-amber-300 bg-amber-50 dark:border-amber-400/40 dark:bg-amber-400/10 rounded-lg px-4 py-3">
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-300">
            DRAFT — NOT LEGAL ADVICE
          </p>
          <p className="text-sm text-amber-800/90 dark:text-amber-200/80 mt-1">
            This document is a placeholder. It states no policy and grants no rights.
          </p>
        </div>

        <p className="text-sm text-gray-500 dark:text-gray-400 mt-6">
          Content forthcoming. Until this page is replaced with a reviewed document, treat
          Eureka as having no published {title.toLowerCase()}.
        </p>
      </main>
    </div>
  );
}