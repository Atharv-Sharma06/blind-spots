import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { PageContainer } from "@/components/layout/page-container";
import { ExperimentsExplorer } from "@/components/experiments/experiments-explorer";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Experiments" };

export default function ExperimentsPage() {
  return (
    <AppShell>
      <PageContainer className="flex flex-1 flex-col gap-6 md:max-w-[1100px] md:mx-0">
        <header className="space-y-3 pt-2">
          <h1 className="text-display font-medium tracking-tight text-fg">Experiments</h1>
          <p className="max-w-[68ch] text-prose text-muted">These are experiments NASA already ran, the data behind every answer.</p>
          <Link
            href="/cabins#cabins"
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#2FD067] px-5 py-1.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-[#0B2414] transition-[filter] hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Pick a cabin to see what to test next <ArrowRight className="size-4 shrink-0" aria-hidden />
          </Link>
        </header>
        <Suspense fallback={<Skeleton className="h-64 w-full rounded-2xl" />}>
          <ExperimentsExplorer />
        </Suspense>
      </PageContainer>
    </AppShell>
  );
}
