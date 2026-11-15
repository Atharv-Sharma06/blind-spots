"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { BookOpen, Compass, FlaskConical, LayoutGrid, Menu, Play, Search, X, type LucideIcon } from "lucide-react";
import { DataSourceBadge } from "@/components/data-source-badge";
import { DEFAULT_CABIN, COVERAGE_STATUS_LABEL, cabinOrderIndex, coverageStatus, shortCabinName, type CoverageStatus } from "@/components/home/cabins";
import { useHeadline, useTargets } from "@/hooks/api";
import { cn } from "@/lib/cn";
import { DATA_CREDIT, SI_NOTE } from "@/lib/copy";
import type { AtmosphereProfile, HeadlineProfile } from "@/lib/types";
import { LogoMark } from "./logo-mark";
import { NAV_ITEMS, isNavActive } from "./nav-links";
import { REPO_URL, RepoLink } from "./repo-link";
import { SiteFooter } from "./site-footer";

/**
 * App shell for /cabins, /explore, /experiments, /methodology and /brief (Reference C):
 *  - desktop (lg+): a white 260 px sidebar (wordmark, nav with icons and count badges, the cabin list with status
 *    dots, footer with the data chip, SI line and the binding sentences) beside a content column with a top bar
 *    (cabin search, Tour, GitHub, black pill action);
 *  - phones: a compact top bar with a menu button; the sidebar content opens as a sheet.
 * Pages render their own content (and their own <h1>) as children; the shell supplies <main id="main">.
 */

const ICONS: Record<(typeof NAV_ITEMS)[number]["href"], LucideIcon> = {
  "/cabins": LayoutGrid,
  "/explore": Compass,
  "/experiments": FlaskConical,
  "/methodology": BookOpen,
};

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

/** Cabins (never the envelope profile) in the canonical order, with plain short names and a coverage status. */
interface CabinEntry {
  id: string;
  name: string;
  /** Everything the search matches on, lower case. */
  haystack: string;
  status: CoverageStatus | null;
}

function useCabinEntries(): CabinEntry[] {
  const targets = useTargets();
  const headline = useHeadline();
  return React.useMemo(() => {
    const byId = new Map<string, HeadlineProfile>();
    for (const h of headline.data?.data.profiles ?? []) byId.set(h.profile_id, h);
    const all: AtmosphereProfile[] = targets.data?.data.profiles ?? [];
    return all
      .filter((p) => p.kind !== "envelope")
      .map((p, i) => ({ p, i }))
      .sort((a, b) => cabinOrderIndex(a.p.profile_id) - cabinOrderIndex(b.p.profile_id) || a.i - b.i)
      .map(({ p }) => {
        const name = shortCabinName(p.profile_id, p.name);
        const h = byId.get(p.profile_id);
        return {
          id: p.profile_id,
          name,
          haystack: `${name} ${p.name} ${p.profile_id.replace(/_/g, " ")}`.toLowerCase(),
          status: h ? coverageStatus(h) : null,
        };
      });
  }, [targets.data, headline.data]);
}

/** Status dot: black = not covered, amber = barely covered, green = covered. The words are in the sr-only text. */
function StatusDot({ status }: { status: CoverageStatus | null }) {
  return (
    <span
      aria-hidden
      className={cn(
        "size-2.5 shrink-0 rounded-full",
        status === "none" && "bg-[#161616]",
        status === "barely" && "bg-[#E8A33B]",
        status === "covered" && "bg-[#2FD067]",
        status === null && "border border-[#CFCCC4]",
      )}
    />
  );
}

function CountBadge({ n, label, active }: { n: number; label: string; active: boolean }) {
  return (
    <span
      role="img"
      aria-label={`${n} ${label}`}
      className={cn(
        "num pointer-events-none absolute right-3 top-1/2 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-[12px] text-muted",
        active ? "bg-white" : "bg-[#EFEEEA]",
      )}
    >
      {n}
    </span>
  );
}

/** Reference C nav: outline icon + 16 px label; the active page is a light grey rounded fill; counts sit outside the link. */
function SideNav({ onNavigate, cabinCount, experimentCount }: { onNavigate?: () => void; cabinCount: number | null; experimentCount: number | null }) {
  const pathname = usePathname() ?? "/";
  return (
    <nav aria-label="Primary">
      <ul className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const active = isNavActive(pathname, item.href);
          const Icon = ICONS[item.href];
          const count =
            item.href === "/cabins" ? { n: cabinCount, label: "cabins" } : item.href === "/experiments" ? { n: experimentCount, label: "experiments" } : null;
          return (
            <li key={item.href} className="relative">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                onClick={onNavigate}
                className={cn(
                  "flex h-11 items-center gap-3 rounded-[10px] px-3 text-[16px] transition-colors",
                  FOCUS,
                  count?.n != null && "pr-11",
                  active ? "bg-[#EFEEEA] font-medium text-fg" : "text-fg/80 hover:bg-[#F3F2EF] hover:text-fg",
                )}
              >
                <Icon className="size-5 shrink-0" strokeWidth={1.6} aria-hidden />
                {item.label}
              </Link>
              {count && count.n != null ? <CountBadge n={count.n} label={count.label} active={active} /> : null}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** "Cabins" group: every cabin with its coverage dot. Reads ?cabin= to mark the selected one, so it sits in Suspense. */
function CabinGroupList({ cabins, onNavigate }: { cabins: CabinEntry[]; onNavigate?: () => void }) {
  const pathname = usePathname() ?? "/";
  const params = useSearchParams();
  const selected = pathname === "/cabins" ? params.get("cabin") || DEFAULT_CABIN : null;
  return (
    <ul className="flex flex-col gap-0.5">
      {cabins.map((c) => {
        const active = selected === c.id;
        return (
          <li key={c.id}>
            <Link
              href={`/cabins?cabin=${encodeURIComponent(c.id)}`}
              aria-current={active ? "true" : undefined}
              onClick={onNavigate}
              className={cn(
                "flex min-h-10 items-center gap-3 rounded-[10px] px-3 py-1.5 text-[14px] leading-5 transition-colors",
                FOCUS,
                active ? "bg-[#EFEEEA] font-medium text-fg" : "text-fg/80 hover:bg-[#F3F2EF] hover:text-fg",
              )}
            >
              <StatusDot status={c.status} />
              <span className="min-w-0">
                {c.name}
                {c.status ? <span className="sr-only">, {COVERAGE_STATUS_LABEL[c.status]}</span> : null}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function CabinGroup({ cabins, onNavigate }: { cabins: CabinEntry[]; onNavigate?: () => void }) {
  if (cabins.length === 0) return null;
  return (
    <section aria-labelledby="shell-cabins-title" className="mt-6">
      <h2 id="shell-cabins-title" className="px-3 pb-2 text-[14px] font-normal text-muted">
        Cabins
      </h2>
      <React.Suspense fallback={null}>
        <CabinGroupList cabins={cabins} onNavigate={onNavigate} />
      </React.Suspense>
      <ul aria-label="Status key" className="mt-3 flex flex-wrap gap-x-3 gap-y-1 px-3 text-[12px] text-muted">
        {(["none", "barely", "covered"] as const).map((s) => (
          <li key={s} className="flex items-center gap-1.5">
            <StatusDot status={s} />
            {COVERAGE_STATUS_LABEL[s]}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Wordmark({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link
      href="/"
      onClick={onNavigate}
      aria-label="Blind Spots, home"
      className={cn("-mx-1 flex h-11 w-fit items-center gap-2.5 rounded-xl px-1", FOCUS)}
    >
      <LogoMark />
      <span className="text-[22px] font-semibold leading-none tracking-[-0.02em] text-fg">Blind Spots</span>
    </Link>
  );
}

/** Sidebar footer: data chip, the SI line and the binding sentences. A real <footer> (contentinfo) on desktop. */
function SidebarFooter() {
  return (
    <footer className="mt-4 flex flex-col items-start gap-1.5 border-t border-[#E4E2DC] px-3 pt-4 text-[12px] leading-4 text-muted">
      <DataSourceBadge />
      <p data-testid="footer-note" className="pt-1">
        Not a certified fire-safety assessment. Not endorsed by NASA.
      </p>
      <Link href="/methodology#si" className={cn("rounded text-fg/85 underline decoration-fg/25 underline-offset-4 hover:text-fg", FOCUS)}>
        {SI_NOTE}
      </Link>
      <p>{DATA_CREDIT}</p>
      <RepoLink variant="text" className="-mx-1 h-8 text-[12px]" />
    </footer>
  );
}

/** Search-like field: type a cabin, Enter opens it on the Cabins page (/cabins?cabin=<id>). No box, muted 18 px text. */
function CabinSearch({ cabins, className, onDone, boxed = false }: { cabins: CabinEntry[]; className?: string; onDone?: () => void; boxed?: boolean }) {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(0);
  const [missed, setMissed] = React.useState(false);
  const listId = React.useId();

  const query = q.trim().toLowerCase();
  const matches = React.useMemo(() => {
    if (!query) return [];
    const terms = query.split(/\s+/);
    return cabins.filter((c) => terms.every((t) => c.haystack.includes(t))).slice(0, 6);
  }, [cabins, query]);

  function go(id: string) {
    router.push(`/cabins?cabin=${encodeURIComponent(id)}`);
    setQ("");
    setOpen(false);
    setMissed(false);
    onDone?.();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" && matches.length > 0) {
      e.preventDefault();
      setOpen(true);
      setActive((a) => (a + 1) % matches.length);
    } else if (e.key === "ArrowUp" && matches.length > 0) {
      e.preventDefault();
      setActive((a) => (a - 1 + matches.length) % matches.length);
    } else if (e.key === "Escape") {
      setOpen(false);
      setMissed(false);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const hit = matches[active] ?? matches[0];
      if (hit) go(hit.id);
      else if (query) setMissed(true);
      else {
        router.push("/cabins");
        onDone?.();
      }
    }
  }

  const showList = open && matches.length > 0;
  return (
    <div className={cn("relative min-w-0", className)}>
      <label className={cn("flex h-12 items-center gap-3", boxed && "rounded-xl border border-[#E4E2DC] bg-white px-3 focus-within:border-fg")}>
        <span className="sr-only">Search cabins</span>
        <Search className="size-5 shrink-0 text-muted" strokeWidth={1.6} aria-hidden />
        <input
          type="search"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList ? `${listId}-${active}` : undefined}
          autoComplete="off"
          spellCheck={false}
          value={q}
          placeholder="Search cabins…"
          onChange={(e) => {
            setQ(e.target.value);
            setActive(0);
            setMissed(false);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
          className="min-w-0 flex-1 appearance-none border-0 bg-transparent text-[18px] text-fg outline-none placeholder:text-muted focus-visible:outline-none [&::-webkit-search-cancel-button]:hidden"
        />
      </label>
      <ul
        id={listId}
        role="listbox"
        aria-label="Matching cabins"
        hidden={!showList}
        className="absolute left-0 right-0 top-full z-40 mt-1 overflow-hidden rounded-2xl border border-[#E4E2DC] bg-white p-1.5 shadow-[0_12px_32px_-12px_rgb(22_22_22/0.25)] md:min-w-[320px]"
      >
        {matches.map((c, i) => (
          <li
            key={c.id}
            id={`${listId}-${i}`}
            role="option"
            aria-selected={i === active}
            onMouseDown={(e) => {
              e.preventDefault();
              go(c.id);
            }}
            onMouseEnter={() => setActive(i)}
            className={cn("flex min-h-10 cursor-pointer items-center gap-3 rounded-[10px] px-3 py-1.5 text-[16px]", i === active && "bg-[#EFEEEA]")}
          >
            <StatusDot status={c.status} />
            <span>{c.name}</span>
            {c.status ? <span className="ml-auto text-[12px] text-muted">{COVERAGE_STATUS_LABEL[c.status]}</span> : null}
          </li>
        ))}
      </ul>
      <p role="status" className={missed ? "px-1 pt-1 text-[14px] text-muted" : "sr-only"}>
        {missed ? `No cabin matches “${q.trim()}”.` : ""}
      </p>
    </div>
  );
}

/** The one black pill: "Check a cabin" everywhere, "Open the Explorer" while you are on the Cabins page. */
function usePrimaryAction(): { href: string; label: string; Icon: LucideIcon } {
  const pathname = usePathname() ?? "/";
  return isNavActive(pathname, "/cabins")
    ? { href: "/explore", label: "Open the Explorer", Icon: Compass }
    : { href: "/cabins", label: "Check a cabin", Icon: LayoutGrid };
}

function PrimaryPill({ className, compactOnPhone = false }: { className?: string; compactOnPhone?: boolean }) {
  const { href, label, Icon } = usePrimaryAction();
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap bg-[#161616] text-white transition-colors hover:bg-[#2b2b2b]",
        compactOnPhone ? "size-11 rounded-[14px] sm:h-12 sm:w-auto sm:px-5" : "h-[52px] rounded-[14px] px-6 text-[16px]",
        FOCUS,
        className,
      )}
    >
      <Icon className="size-5 shrink-0" strokeWidth={1.7} aria-hidden />
      <span className={compactOnPhone ? "sr-only sm:not-sr-only sm:text-[15px]" : undefined}>{label}</span>
    </Link>
  );
}

function TourButton({ className, onNavigate }: { className?: string; onNavigate?: () => void }) {
  return (
    <Link
      href="/cabins?demo=1"
      onClick={onNavigate}
      className={cn("inline-flex h-11 shrink-0 items-center gap-2 rounded-xl px-3 text-[16px] text-fg transition-colors hover:bg-fg/5", FOCUS, className)}
    >
      <Play className="size-[18px]" strokeWidth={1.7} aria-hidden />
      Tour
    </Link>
  );
}

function MenuSheet({ cabins, cabinCount, experimentCount }: { cabins: CabinEntry[]; cabinCount: number | null; experimentCount: number | null }) {
  const [open, setOpen] = React.useState(false);
  const close = React.useCallback(() => setOpen(false), []);
  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger
        className={cn("-ml-1 inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-fg hover:bg-fg/5", FOCUS)}
        aria-label="Open the menu"
      >
        <Menu className="size-6" strokeWidth={1.6} aria-hidden />
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-[#161616]/40 data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed inset-y-0 left-0 z-50 flex w-[min(320px,88vw)] flex-col overflow-y-auto bg-white px-4 pb-6 pt-3 shadow-[24px_0_48px_-24px_rgb(22_22_22/0.35)] data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in"
        >
          <DialogPrimitive.Title className="sr-only">Menu</DialogPrimitive.Title>
          <div className="mb-3 flex items-center justify-between">
            <Wordmark onNavigate={close} />
            <DialogPrimitive.Close className={cn("inline-flex size-11 items-center justify-center rounded-xl text-fg hover:bg-fg/5", FOCUS)} aria-label="Close the menu">
              <X className="size-5" strokeWidth={1.6} aria-hidden />
            </DialogPrimitive.Close>
          </div>
          <CabinSearch cabins={cabins} boxed className="mb-3" onDone={close} />
          <SideNav onNavigate={close} cabinCount={cabinCount} experimentCount={experimentCount} />
          <CabinGroup cabins={cabins} onNavigate={close} />
          <div className="mt-5 flex flex-wrap items-center gap-x-1 border-t border-[#E4E2DC] pt-3">
            <TourButton onNavigate={close} />
            <RepoLink variant="bar" />
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const cabins = useCabinEntries();
  const headline = useHeadline();
  const cabinCount = cabins.length > 0 ? cabins.length : null;
  const experimentCount = headline.data?.data.envelope.n_experiments ?? null;

  return (
    <div className="flex min-h-dvh flex-1 bg-bg text-fg lg:items-start">
      {/* Desktop sidebar */}
      <div className="sticky top-0 hidden h-dvh w-[260px] shrink-0 flex-col border-r border-[#E4E2DC] bg-white px-4 pb-5 pt-6 lg:flex print:hidden!">
        <div className="px-0.5 pb-6">
          <Wordmark />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-2">
          <SideNav cabinCount={cabinCount} experimentCount={experimentCount} />
          <CabinGroup cabins={cabins} />
        </div>
        <SidebarFooter />
      </div>

      <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
        {/* Phones: compact top bar; the menu sheet carries search, nav and the cabin list. */}
        <div className="flex h-16 items-center gap-2 border-b border-[#E4E2DC] bg-white px-4 lg:hidden print:hidden!">
          <MenuSheet cabins={cabins} cabinCount={cabinCount} experimentCount={experimentCount} />
          <Link href="/" aria-label="Blind Spots, home" className={cn("flex h-11 min-w-0 items-center gap-2 rounded-xl", FOCUS)}>
            <LogoMark className="size-7" />
            <span className="truncate text-[18px] font-semibold tracking-[-0.02em]">Blind Spots</span>
          </Link>
          <PrimaryPill compactOnPhone className="ml-auto" />
        </div>
        {/* Desktop top bar */}
        <div className="hidden items-center gap-3 px-8 pb-2 pt-5 lg:flex print:hidden!">
          <CabinSearch cabins={cabins} className="max-w-[460px] flex-1" />
          <div className="ml-auto flex items-center gap-1">
            <TourButton />
            {REPO_URL ? <RepoLink variant="bar" /> : null}
            <PrimaryPill className="ml-3" />
          </div>
        </div>
        <main id="main" tabIndex={-1} className="flex flex-1 flex-col outline-none">
          {children}
        </main>
        <SiteFooter withBadge className="lg:hidden" />
      </div>
    </div>
  );
}
