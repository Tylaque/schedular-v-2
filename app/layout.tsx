import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Scheduler — Multi-project scheduling platform",
  description:
    "Centralize project scheduling by managing administrator availability, participant bookings, and automated meeting coordination from a single platform.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
