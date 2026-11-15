import Link from "next/link";
import { Play } from "lucide-react";
import { LogoMark } from "./logo-mark";
import { NavLinks } from "./nav-links";

/**
 * Landing header (Reference A): logo mark + tiny all-caps wordmark at the left, four tiny uppercase links centred,
 * a circular outlined icon button (the tour) and an outlined pill at the right. Transparent over the cream page.
 * Rendered only on "/" and on the 404 page; the app pages use the sidebar shell (app-shell.tsx).
 */
export function SiteHeader() {
  return (
    <header className="relative z-30">
      <div className="mx-auto grid max-w-[1680px] grid-cols-[1fr_auto] items-center gap-x-3 px-4 pt-2 md:grid-cols-[1fr_auto_1fr] md:px-8 md:pt-4">
        <Link
          href="/"
          className="-mx-1 flex h-12 w-fit items-center gap-2.5 rounded-full px-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          aria-label="Blind Spots, home"
        >
          <LogoMark />
          <span className="whitespace-nowrap text-[12px] font-semibold uppercase tracking-[0.12em] text-fg">Blind Spots</span>
        </Link>
        <NavLinks className="order-3 col-span-2 md:order-none md:col-span-1" />
        <div className="flex items-center justify-end gap-2.5">
          <Link
            href="/cabins?demo=1"
            title="Watch the tour"
            className="btn-round inline-flex size-11 items-center justify-center max-[359px]:hidden rounded-full border border-fg/15 text-fg transition-colors hover:bg-fg/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <Play className="size-4" aria-hidden />
            <span className="sr-only">Watch the tour</span>
          </Link>
          <Link
            href="/cabins"
            className="pill-outline inline-flex h-11 items-center justify-center whitespace-nowrap rounded-full border border-fg/25 px-4 text-[11px] font-medium uppercase tracking-[0.08em] text-fg transition-colors hover:bg-fg/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent md:px-5"
          >
            Check a cabin
          </Link>
        </div>
      </div>
    </header>
  );
}
