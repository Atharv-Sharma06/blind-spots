import Link from "next/link";
import { cn } from "@/lib/cn";

/** Landing look (Reference A): colours come from the theme tokens so it follows light and dark. The black terminal section keeps literal black/white. */
export const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg";

/** Soft placeholder with reserved size: no numbers while loading. */
export function Hold({ className, label, dark }: { className?: string; label: string; dark?: boolean }) {
  return (
    <span
      role="status"
      aria-label={label}
      className={cn("block animate-pulse rounded-md motion-reduce:animate-none", dark ? "bg-white/15" : "bg-fg/10", className)}
    />
  );
}

/** Circular outlined icon button (40 to 44 px), as a link. */
export function RoundLink({
  href,
  label,
  children,
  external,
  className,
  dark,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
  external?: boolean;
  className?: string;
  dark?: boolean;
}) {
  const cls = cn(
    "inline-flex size-11 shrink-0 items-center justify-center rounded-full border transition-colors",
    dark ? "border-white/25 text-white hover:bg-white/10 focus-visible:outline-white" : "border-fg/15 text-fg hover:bg-fg/5",
    FOCUS,
    className,
  );
  return external ? (
    <a href={href} aria-label={label} title={label} className={cls} target="_blank" rel="noreferrer">
      {children}
    </a>
  ) : (
    <Link href={href} aria-label={label} title={label} className={cls}>
      {children}
    </Link>
  );
}
