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
    <PageContainer className="flex flex-1 flex-col gap-4 md:max-w-[1100px]">
      <header className="space-y-1">
        <h1 className="text-display font-semibold text-fg">Experiments</h1>
        <p className="max-w-[68ch] text-title text-fg">Every past flame experiment in our data, with its NASA source.</p>
        <p className="max-w-[68ch] text-prose text-muted">These are experiments NASA already ran, the data behind every answer.</p>
        <Link href="/#cabins" className="inline-flex min-h-10 items-center gap-1 rounded-sm text-prose text-observed underline underline-offset-2 hover:text-fg">
          To see which one to run next, pick a cabin <ArrowRight className="size-4" aria-hidden />
        </Link>
      </header>
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <ExperimentsExplorer />
      </Suspense>
    </PageContainer>
  );
}
