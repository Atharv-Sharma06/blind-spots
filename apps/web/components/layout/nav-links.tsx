"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

/** The four tool pages, in reading order. The logo links to the landing page ("/"). */
export const NAV_ITEMS = [
  { href: "/cabins", label: "Cabins" },
  { href: "/findings", label: "Findings" },
  { href: "/explore", label: "Explorer" },
  { href: "/experiments", label: "Experiments" },
  { href: "/methodology", label: "How it works" },
] as const;

export function isNavActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Landing-header nav (Reference A): four tiny uppercase links, 11 px, tracking .08em, medium weight, generous gaps.
 * Wraps onto a second line on very narrow phones instead of scrolling sideways. The app pages use the sidebar nav
 * in app-shell.tsx instead.
 */
export function NavLinks({ className }: { className?: string }) {
  const pathname = usePathname() ?? "/";
  return (
    <nav aria-label="Primary" className={className}>
      <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-0 md:gap-x-9">
        {NAV_ITEMS.map((item) => {
          const active = isNavActive(pathname, item.href);
          return (
            <li key={item.href} className="flex">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-10 items-center whitespace-nowrap rounded-full text-[11px] font-medium uppercase tracking-[0.08em] transition-opacity focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                  active ? "text-fg underline decoration-1 underline-offset-8" : "text-fg/70 hover:text-fg",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
