import { PageContainer } from "@/components/layout/page-container";
import { ExploreWorkspace } from "@/components/explore/explore-workspace";
import { SectionHeader } from "@/components/ui/section-header";

export default function ExplorePage() {
  return (
    <PageContainer className="flex flex-1 flex-col gap-5">
      <SectionHeader
        as="h1"
        title="Experimental coverage"
        description="Explore what NASA has measured — and what remains uncertain."
      />
      <ExploreWorkspace />
    </PageContainer>
  );
}
