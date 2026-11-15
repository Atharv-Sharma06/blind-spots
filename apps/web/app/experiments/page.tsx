import type { Metadata } from "next";
import { Suspense } from "react";
import { PageContainer } from "@/components/layout/page-container";
import { ExperimentsExplorer } from "@/components/experiments/experiments-explorer";
import { SectionHeader } from "@/components/ui/section-header";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Experiments" };

export default function ExperimentsPage() {
  return (
    <PageContainer className="flex flex-1 flex-col gap-4">
      <SectionHeader
        as="h1"
        title="Experiments"
        description="One row per physical test in the integrated NASA records, with the source cell behind every value."
      />
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <ExperimentsExplorer />
      </Suspense>
    </PageContainer>
  );
}
