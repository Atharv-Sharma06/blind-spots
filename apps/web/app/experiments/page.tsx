import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageContainer } from "@/components/layout/page-container";
import { ExperimentsExplorer } from "@/components/experiments/experiments-explorer";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Experiments" };

export default function ExperimentsPage() {
  return (
    <PageContainer className="flex flex-1 flex-col gap-6 md:max-w-[1100px]">
      <header className="space-y-3 pt-2">
        <h1 className="text-display font-semibold tracking-tight text-fg">Experiments</h1>
        <p className="max-w-[68ch] text-prose text-muted">These are experiments NASA already ran, the data behind every answer.</p>
        <Link
          href="/cabins#cabins"
          className="pill-yellow inline-flex h-11 items-center gap-2 rounded-full px-5 text-ui font-semibold hover:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Pick a cabin to see what to test next <ArrowRight className="size-4" aria-hidden />
        </Link>
      </header>
      <Suspense fallback={<Skeleton className="h-64 w-full rounded-2xl" />}>
        <ExperimentsExplorer />
      </Suspense>
    </PageContainer>
  );
}
