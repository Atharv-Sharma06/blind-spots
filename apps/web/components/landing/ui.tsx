import Link from "next/link";
import { cn } from "@/lib/cn";

/** Ink-on-cream landing look (Reference A). Colours are literal so the landing never depends on the app theme. */
export const INK = "#161616";
export const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#161616]";

/** Soft placeholder with reserved size: no numbers while loading. */
export function Hold({ className, label, dark }: { className?: string; label: string; dark?: boolean }) {
  return (
    <span
      role="status"
      aria-label={label}
      className={cn("block animate-pulse rounded-md motion-reduce:animate-none", dark ? "bg-white/15" : "bg-[#161616]/10", className)}
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
    dark ? "border-white/25 text-white hover:bg-white/10 focus-visible:outline-white" : "border-[#161616]/15 text-[#161616] hover:bg-[#161616]/5",
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
