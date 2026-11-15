"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

/** The four tool pages, in reading order. The logo links to the landing page ("/"). */
export const NAV_ITEMS = [
  { href: "/cabins", label: "Cabins" },
  { href: "/explore", label: "Explorer" },
  { href: "/experiments", label: "Experiments" },
  { href: "/methodology", label: "How it works" },
] as const;

export function isNavActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Four links in a dark pill track. Phones: a 4-column grid that fills the row (40 px tall, no sideways scroll down
 * to 320 px). From md up: an inline pill group. The active page is a light pill with dark text.
 */
export function NavLinks({ className }: { className?: string }) {
  const pathname = usePathname() ?? "/";
  return (
    <nav aria-label="Primary" className={className}>
      <ul className="grid grid-cols-[repeat(4,auto)] justify-between gap-0 rounded-full border border-white/[0.06] bg-white/[0.04] p-0.5 min-[360px]:gap-0.5 min-[360px]:p-1 md:flex md:items-center md:gap-0.5">
        {NAV_ITEMS.map((item) => {
          const active = isNavActive(pathname, item.href);
          return (
            <li key={item.href} className="flex">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-10 w-full items-center justify-center whitespace-nowrap rounded-full px-[5px] text-[length:var(--text-label)] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent min-[360px]:px-2 min-[360px]:text-[length:var(--text-ui)] min-[400px]:px-3 md:h-8 md:px-3.5",
                  active ? "bg-fg text-bg" : "text-muted hover:bg-white/[0.07] hover:text-fg",
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
