import Link from "next/link";
import type { ReactNode } from "react";
import { SITE_NAME } from "@/lib/site";

type SiteHeaderProps = {
  title: string;
  subtitle: string;
  children?: ReactNode;
  /** Tighter hero for the main kitchen screen */
  compact?: boolean;
};

export function SiteHeader({ title, subtitle, children, compact }: SiteHeaderProps) {
  return (
    <header className="relative overflow-hidden bg-hp-sage-deep text-hp-cream">
      <div className="hp-colorbar" aria-hidden>
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>
      <div
        className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-hp-sky/25 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-20 left-1/3 h-52 w-52 rounded-full bg-hp-gold/20 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute right-1/4 top-24 h-28 w-28 rounded-full bg-hp-blush/20 blur-2xl"
        aria-hidden
      />
      <div
        className={`hp-container relative ${compact ? "py-4 sm:py-5" : "py-8 sm:py-12"}`}
      >
        <nav
          className={`flex flex-wrap items-center justify-between gap-3 ${compact ? "mb-4" : "mb-8"}`}
          aria-label="Primary"
        >
          <Link href="/" className="group flex items-center gap-2.5">
            <span className="hp-mark" aria-hidden>
              HP
            </span>
            <span className="hp-display text-xl text-hp-cream group-hover:text-hp-gold sm:text-2xl">
              {SITE_NAME}
            </span>
          </Link>
          <div className="flex flex-wrap gap-2">
            <Link href="/" className="hp-nav-link">
              Kitchen
            </Link>
            <Link href="/history" className="hp-nav-link">
              History
            </Link>
            <Link href="/history/all" className="hp-nav-link">
              All pots
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
        {!compact && <p className="hp-kicker">Hacktoberfest 2026</p>}
        <h1
          className={`hp-display-title max-w-3xl text-balance text-hp-cream ${compact ? "mt-1 text-[clamp(1.75rem,3vw+1rem,2.75rem)]" : "mt-3"}`}
        >
          {title}
        </h1>
        {!compact && (
          <ul className="mt-5 flex flex-wrap gap-2" aria-label="Project themes">
            <li className="hp-sticker hp-sticker-gold">Build for a Friend</li>
            <li className="hp-sticker hp-sticker-sky">Open weights</li>
            <li className="hp-sticker hp-sticker-pink">Cook approves</li>
          </ul>
        )}
        <p
          className={`max-w-2xl text-pretty leading-relaxed text-hp-cream/90 ${compact ? "mt-2 text-xs sm:text-sm" : "mt-5 text-sm sm:text-base"}`}
        >
          {subtitle}
        </p>
        {children ? (
          <div className={`flex flex-wrap gap-3 ${compact ? "mt-3" : "mt-6"}`}>{children}</div>
        ) : null}
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t-2 border-hp-ink/10 bg-hp-cream px-4 py-5 text-center text-xs leading-relaxed text-zinc-700 sm:px-6">
      <p className="hp-container">
        <a
          className="font-semibold text-hp-sage-deep underline decoration-hp-gold decoration-2 underline-offset-4 hover:text-hp-tomato"
          href="https://github.com/smriad/house-pot"
          target="_blank"
          rel="noopener noreferrer"
        >
          house-pot on GitHub
        </a>
        <span className="mx-2 text-hp-ink/30" aria-hidden>
          ·
        </span>
        <a
          className="font-semibold text-hp-sage-deep underline decoration-hp-gold decoration-2 underline-offset-4 hover:text-hp-tomato"
          href="https://hacktoberfest.com"
          target="_blank"
          rel="noopener noreferrer"
        >
          Hacktoberfest 2026
        </a>
      </p>
      <p className="hp-container mt-2 font-mono text-[10px] tracking-wide text-hp-sage">
        powered by MLH and DEV
      </p>
    </footer>
  );
}
