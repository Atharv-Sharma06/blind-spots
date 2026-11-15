"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

export const NAV_ITEMS = [
  { href: "/", label: "Explore" },
  { href: "/experiments", label: "Experiments" },
  { href: "/methodology", label: "Methodology" },
] as const;

export function NavLinks({ className }: { className?: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Primary" className={className}>
      <ul className="flex items-center gap-0.5">
        {NAV_ITEMS.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-7 items-center rounded-md px-2.5 text-[13px] font-medium transition-colors",
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
