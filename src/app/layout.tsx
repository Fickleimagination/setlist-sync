import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import "./globals.css";

// Uses the OS/browser's own font stack rather than next/font/google: a
// build or demo machine without outbound access to fonts.googleapis.com
// (common on restricted networks) would otherwise fail outright. See
// globals.css for the stack (--font-sans/--font-mono).

export const metadata: Metadata = {
  title: "Setlist Sync",
  description: "A One Direction discography recommendation system — DBMS Level 3 project.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
        <Navbar />
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
