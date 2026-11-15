import type { Metadata } from "next";
import { BookOpen } from "lucide-react";
import { PageContainer } from "@/components/layout/page-container";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeader } from "@/components/ui/section-header";

export const metadata: Metadata = { title: "Methodology" };

const TOPICS = ["Data", "Modeling", "Active learning", "Validation", "Reproducibility", "Sources"];

export default function MethodologyPage() {
  return (
    <PageContainer width="reading" className="flex flex-1 flex-col gap-5">
      <SectionHeader
        as="h1"
        title="Methodology"
        description="How the records were integrated, how the model is fit and checked, and how candidates are ranked."
      />
      <div className="rounded-lg border border-border bg-surface px-4">
        <EmptyState
          icon={<BookOpen aria-hidden />}
          title="Methodology is not published in this build"
          description={`Planned sections: ${TOPICS.join(", ")}.`}
        />
      </div>
    </PageContainer>
  );
}
