"use client";

import { useEffect, useState } from "react";

export default function GreetingHeader({
  name,
  todayCount,
}: {
  name: string;
  todayCount: number;
}) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
  }, []);

  if (!now) return <div className="mb-6" aria-hidden />;

  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const dateLabel = now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  const firstName = (name || "there").trim().split(/\s+/)[0];

  return (
    <div className="mb-6">
      <p className="text-2xl font-bold text-gray-900 dark:text-gray-50">
        {greeting}, {firstName}
      </p>
      <p className="text-sm text-gray-500 mt-1 dark:text-gray-400">{dateLabel}</p>
      <p className="text-sm text-gray-500 mt-1 dark:text-gray-400">
        {todayCount > 0 ? (
          <>
            here&apos;s what&apos;s scheduled today —{" "}
            <span className="font-semibold text-brand-600">
              {todayCount} session{todayCount !== 1 ? "s" : ""}
            </span>
          </>
        ) : (
          "Nothing scheduled for you today"
        )}
      </p>
    </div>
  );
}
