import type { Metadata } from "next";
import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "@/components/ThemeProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Scheduler — Multi-project scheduling platform",
  description:
    "A scheduling platform. Super Admins configure projects, Admins submit their availability, and participants book from consolidated slots.",
  verification: {
    google: "googlec95e452a1a00f6cd",
  },
};

const THEME_SCRIPT = `(function(){try{var s=localStorage.getItem("theme");var d=s==="dark"?true:s==="light"?false:window.matchMedia("(prefers-color-scheme: dark)").matches;if(d)document.documentElement.classList.add("dark");}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="bg-gray-50 text-gray-900 antialiased">
        <SessionProvider>
          <ThemeProvider>{children}</ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
