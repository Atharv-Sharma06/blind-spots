import Link from "next/link";
import { DataSourceBadge } from "@/components/data-source-badge";
import { LogoMark } from "./logo-mark";
import { NavLinks } from "./nav-links";
import { RepoLink } from "./repo-link";

/**
 * Logo, four nav words, a tiny data chip and (when NEXT_PUBLIC_REPO_URL is set) the GitHub link (hidden under 360 px, where it would wrap). On phones the nav
 * sits on its own row under the logo and the header scrolls away; from md up it is one sticky row.
 */
export function SiteHeader() {
  return (
    <header className="z-30 border-b border-border bg-bg md:sticky md:top-0 md:bg-bg/95 md:backdrop-blur-[2px]">
      <div className="mx-auto flex max-w-[1680px] flex-wrap items-center gap-x-3 px-3 min-[360px]:px-4 md:min-h-[var(--header-h)] md:flex-nowrap md:gap-x-6 md:px-6">
        <Link
          href="/"
          className="-mx-1 flex h-12 shrink-0 items-center gap-2 rounded-sm px-1 md:mx-0 md:h-auto md:px-0"
          aria-label="Blind Spots, home"
        >
          <LogoMark />
          <span className="text-title font-semibold tracking-[-0.01em]">Blind Spots</span>
        </Link>
        <NavLinks className="order-3 -mx-1 w-[calc(100%+0.5rem)] border-t border-border pb-0.5 pt-0.5 md:order-none md:m-0 md:w-auto md:border-0 md:p-0" />
        <div className="order-2 ml-auto flex min-w-0 items-center gap-0.5">
          <DataSourceBadge />
          <RepoLink />
        </div>
      </div>
    </header>
  );
}
