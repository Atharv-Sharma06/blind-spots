import type { Metadata } from "next";
import { Table2 } from "lucide-react";
import { PageContainer } from "@/components/layout/page-container";
import { DataPageState } from "@/components/data-page-state";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeader } from "@/components/ui/section-header";

export const metadata: Metadata = { title: "Experiments" };

export default function ExperimentsPage() {
  return (
    <PageContainer className="flex flex-1 flex-col gap-5">
      <SectionHeader
        as="h1"
        title="Experiments"
        description="One row per physical test in the integrated NASA records, with the source cell behind every value."
      />
      <div className="rounded-lg border border-border bg-surface px-4">
        <DataPageState>
          <EmptyState
            icon={<Table2 aria-hidden />}
            title="No experiments loaded"
            description="The experiment table is not built yet. When it is, every row will link back to its source file, sheet and row."
          />
        </DataPageState>
      </div>
    </PageContainer>
  );
}
