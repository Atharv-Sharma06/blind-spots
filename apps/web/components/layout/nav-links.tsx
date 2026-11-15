"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

/** Left to right: the simple answer, the expert workspace, the research list, the explanation. */
export const NAV_ITEMS = [
  { href: "/", label: "Cabins" },
  { href: "/explore", label: "Explorer" },
  { href: "/experiments", label: "Experiments" },
  { href: "/methodology", label: "How it works" },
] as const;

export function isNavActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Primary navigation. One element for every width: on phones it is a four-column row (each link at least 40 px tall,
 * no horizontal scroll down to 320 px); from md up it is an inline list next to the logo.
 */
export function NavLinks({ className }: { className?: string }) {
  const pathname = usePathname() ?? "/";
  return (
    <nav aria-label="Primary" className={className}>
      <ul className="grid grid-cols-[repeat(4,auto)] justify-between gap-x-0.5 md:flex md:items-center md:gap-0.5">
        {NAV_ITEMS.map((item) => {
          const active = isNavActive(pathname, item.href);
          return (
            <li key={item.href} className="flex">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-10 items-center justify-center whitespace-nowrap rounded-md px-1 text-label font-medium transition-colors min-[360px]:px-1.5 min-[360px]:text-ui min-[400px]:px-2.5 md:h-8 md:px-3",
                  active ? "bg-subtle text-fg" : "text-muted hover:bg-subtle/70 hover:text-fg",
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
