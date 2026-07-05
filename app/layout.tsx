import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Scheduling Platform",
  description: "Multi-project scheduling platform — booking prototype",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
