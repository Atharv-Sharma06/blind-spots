import Link from "next/link";
import { DataSourceBadge } from "@/components/data-source-badge";
import { LogoMark } from "./logo-mark";
import { NavLinks } from "./nav-links";
import { RepoLink } from "./repo-link";

/**
 * Brand, primary navigation, where the numbers come from (live service or precomputed snapshot; visible on
 * every route) and the repository link when NEXT_PUBLIC_REPO_URL is set. Dataset/model versions live in the footer.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg/95 backdrop-blur-[2px] supports-[backdrop-filter]:bg-bg/90">
      <div className="mx-auto flex min-h-[var(--header-h)] max-w-[1680px] flex-wrap items-center gap-x-6 gap-y-1 px-4 py-1.5 md:flex-nowrap md:px-6 md:py-0">
        <Link href="/" className="flex shrink-0 items-center gap-2 rounded-sm" aria-label="Blind Spots, home">
          <LogoMark />
          <span className="text-prose font-semibold tracking-[-0.01em]">Blind Spots</span>
        </Link>
        <NavLinks className="order-3 -mx-2 w-full overflow-x-auto md:order-none md:mx-0 md:w-auto" />
        <div className="ml-auto flex min-w-0 items-center gap-2">
          <DataSourceBadge className="h-6 min-w-0 max-w-[58vw] border-border bg-surface font-normal text-muted sm:max-w-none [&>span]:truncate [&>span:not([data-part])]:font-sans [&>[data-part=version]]:hidden sm:[&>[data-part=version]]:inline" />
          <RepoLink className="hidden sm:inline-flex" />
        </div>
      </div>
    </header>
  );
}
