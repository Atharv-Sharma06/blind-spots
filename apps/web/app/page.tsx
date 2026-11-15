import { PageContainer } from "@/components/layout/page-container";
import { ExploreWorkspace } from "@/components/explore/explore-workspace";

export default function ExplorePage() {
  return (
    <PageContainer className="flex flex-1 flex-col gap-5 md:py-6">
      <ExploreWorkspace />
    </PageContainer>
  );
}
