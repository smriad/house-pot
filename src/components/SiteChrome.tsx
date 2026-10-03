import Link from "next/link";
import type { ReactNode } from "react";
import { SITE_NAME } from "@/lib/site";

type SiteHeaderProps = {
  title: string;
  subtitle: string;
  children?: ReactNode;
};

export function SiteHeader({ title, subtitle, children }: SiteHeaderProps) {
  return (
    <header className="relative overflow-hidden border-b border-hp-sage/25 bg-hp-sage text-hp-cream">
      <div
        className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-hp-sky/20 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-16 left-1/4 h-48 w-48 rounded-full bg-hp-gold/15 blur-3xl"
        aria-hidden
      />
      <div className="hp-container relative py-8 sm:py-10">
        <nav
          className="mb-6 flex flex-wrap items-center justify-between gap-3"
          aria-label="Primary"
        >
          <Link
            href="/"
            className="font-mono text-xs font-medium uppercase tracking-[0.22em] text-hp-sky transition-opacity hover:opacity-90"
          >
            {SITE_NAME}
          </Link>
          <div className="flex flex-wrap gap-2">
            <Link href="/" className="hp-nav-link">
              Kitchen
            </Link>
            <Link href="/history" className="hp-nav-link">
              History
            </Link>
            <a
              href="https://github.com/smriad/house-pot"
              className="hp-nav-link"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </a>
          </div>
        </nav>
        <h1 className="font-mono text-2xl font-semibold tracking-tight sm:text-3xl md:text-4xl">
          {title}
        </h1>
        <p className="mt-3 max-w-2xl text-pretty text-sm leading-relaxed text-hp-cream/90 sm:text-base">
          {subtitle}
        </p>
        {children ? <div className="mt-5 flex flex-wrap gap-3">{children}</div> : null}
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-hp-sage/15 bg-hp-cream/80 px-4 py-8 text-center text-xs text-zinc-600 sm:px-6">
      <p className="hp-container">
        <a
          className="font-medium text-hp-sage underline decoration-hp-sage/30 underline-offset-2 hover:decoration-hp-sage"
          href="https://github.com/smriad/house-pot"
          target="_blank"
          rel="noopener noreferrer"
        >
          house-pot on GitHub
        </a>
        <span className="mx-2 text-zinc-400" aria-hidden>·</span>
        Hacktoberfest — Build for a Friend
      </p>
    </footer>
  );
}
