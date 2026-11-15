import type { Metadata } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { PageContainer } from "@/components/layout/page-container";
import { ExploreWorkspace } from "@/components/explore/explore-workspace";

export const metadata: Metadata = { title: "Explorer" };

export default function ExplorePage() {
  return (
    <AppShell>
      <PageContainer className="flex flex-1 flex-col gap-5 md:py-6">
        <ExploreWorkspace />
      </PageContainer>
    </AppShell>
  );
}
