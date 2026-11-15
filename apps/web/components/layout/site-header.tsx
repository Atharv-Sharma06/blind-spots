import Link from "next/link";
import { DataSourceBadge } from "@/components/data-source-badge";
import { LogoMark } from "./logo-mark";
import { NavLinks } from "./nav-links";
import { RepoLink } from "./repo-link";

/**
 * Dark, slightly translucent bar with a blur: logo (links to the landing page "/"), the four tool pages as a pill
 * group, a tiny data chip and (when NEXT_PUBLIC_REPO_URL is set) a circular GitHub button. On phones the pill nav
 * sits on its own full-width row under the logo and the header scrolls away; from md up it is one sticky row.
 */
export function SiteHeader() {
  return (
    <header className="z-30 border-b border-white/[0.06] bg-bg/80 backdrop-blur-md backdrop-saturate-150 md:sticky md:top-0">
      <div className="mx-auto flex max-w-[1680px] flex-wrap items-center gap-x-3 gap-y-1 px-3 pb-2 pt-1 min-[360px]:px-4 md:min-h-[calc(var(--header-h)+8px)] md:flex-nowrap md:gap-x-6 md:px-6 md:py-1.5">
        <Link
          href="/"
          className="-mx-1 flex h-12 shrink-0 items-center gap-2.5 rounded-full px-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent md:mx-0 md:h-10 md:px-0"
          aria-label="Blind Spots, home"
        >
          <LogoMark />
          <span className="text-title font-semibold tracking-[-0.01em] text-fg">Blind Spots</span>
        </Link>
        <NavLinks className="order-3 w-full md:order-none md:w-auto" />
        <div className="order-2 ml-auto flex min-w-0 items-center gap-1.5">
          <DataSourceBadge />
          <RepoLink />
        </div>
      </div>
    </header>
  );
}
