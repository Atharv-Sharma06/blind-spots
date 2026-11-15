import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { LogoMark } from "./logo-mark";
import { NavLinks } from "./nav-links";
import { VersionChip } from "./version-chip";

const REPO_URL = process.env.NEXT_PUBLIC_REPO_URL;

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg">
      <div className="mx-auto flex min-h-[var(--header-h)] max-w-[1680px] flex-wrap items-center gap-x-6 gap-y-1 px-4 py-1.5 md:flex-nowrap md:px-6 md:py-0">
        <Link href="/" className="flex items-center gap-2 rounded-sm" aria-label="Blind Spots, home">
          <LogoMark />
          <span className="text-[14px] font-semibold tracking-[-0.01em]">Blind Spots</span>
        </Link>
        <NavLinks className="order-3 -mx-2 w-full overflow-x-auto md:order-none md:mx-0 md:w-auto" />
        <div className="ml-auto flex items-center gap-3">
          <VersionChip />
          {REPO_URL ? (
            <a
              href={REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-7 items-center gap-1 rounded-md px-1.5 text-[13px] text-muted transition-colors hover:text-fg"
            >
              GitHub
              <ExternalLink className="size-3" aria-hidden />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          ) : null}
        </div>
      </div>
    </header>
  );
}
