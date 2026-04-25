import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"]
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"]
});

export const metadata: Metadata = {
  title: "Runbook — Embedded AI onboarding",
  description:
    "Turn your docs into an embedded onboarding copilot. Add an AI guide to any app in one line of code.",
  openGraph: {
    title: "Runbook — Embedded AI onboarding",
    description: "Turn your docs into an embedded onboarding copilot."
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body suppressHydrationWarning className="min-h-full flex flex-col bg-slate-950 text-slate-100">
        <header className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/90 backdrop-blur-xl">
          <nav className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3.5 text-sm sm:px-6">
            <div className="flex flex-wrap items-center gap-1">
              <Link href="/" className="rounded-lg px-3 py-1.5 font-semibold text-white hover:bg-white/10">
                Home
              </Link>
              <Link href="/studio" className="rounded-lg px-3 py-1.5 text-slate-300 hover:bg-white/10 hover:text-white">
                Studio
              </Link>
              <Link
                href="/embed-demo"
                className="rounded-lg px-3 py-1.5 text-slate-300 hover:bg-white/10 hover:text-white"
              >
                Embed demo
              </Link>
            </div>
            <p className="hidden text-[11px] text-slate-500 sm:block">
              Add an AI guide to any app in <span className="text-slate-400">one line of code</span>
            </p>
          </nav>
        </header>
        <div className="flex-1">{children}</div>
      </body>
    </html>
  );
}
