import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Scheduler — Multi-project scheduling platform",
  description:
    "A Doodle-style scheduling platform. Super Admins configure projects, Admins submit their availability, and participants book from consolidated slots.",
  verification: {
    google: "googlec95e452a1a00f6cd",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
