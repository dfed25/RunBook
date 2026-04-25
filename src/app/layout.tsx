import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Runbook",
  description: "AI onboarding copilot demo",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-slate-950 text-slate-100">
        <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-900/90 backdrop-blur-xl">
          <nav className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3 text-sm sm:px-6">
            <Link href="/" className="mr-2 rounded-md px-2 py-1 font-semibold text-cyan-300 hover:bg-slate-800">
              Runbook
            </Link>
            <Link href="/dashboard" className="rounded-md px-2 py-1 text-slate-200 hover:bg-slate-800">
              New Hire Dashboard
            </Link>
            <Link href="/manager" className="rounded-md px-2 py-1 text-slate-200 hover:bg-slate-800">
              Manager Dashboard
            </Link>
            <Link href="/manager/tasks" className="rounded-md px-2 py-1 text-slate-200 hover:bg-slate-800">
              Task Setup
            </Link>
            <Link href="/demo/github" className="rounded-md px-2 py-1 text-slate-200 hover:bg-slate-800">
              Demo: GitHub
            </Link>
            <Link href="/demo/expenses" className="rounded-md px-2 py-1 text-slate-200 hover:bg-slate-800">
              Demo: Expenses
            </Link>
          </nav>
        </header>
        <div className="flex-1">{children}</div>
      </body>
    </html>
  );
}
