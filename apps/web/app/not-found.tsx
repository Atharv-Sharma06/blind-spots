import type { Metadata } from "next";
import Link from "next/link";
import { PageContainer } from "@/components/layout/page-container";
import { ErrorState } from "@/components/ui/error-state";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <PageContainer width="reading" className="flex-1">
      <h1 className="sr-only">Page not found</h1>
      <ErrorState
        code="not_found"
        description="This address does not match a page in Blind Spots. Check the link, or start from Explore."
        action={
          <>
            <Button asChild size="sm" variant="primary">
              <Link href="/">Back to Explore</Link>
            </Button>
            <Button asChild size="sm" variant="ghost">
              <Link href="/methodology">Methodology</Link>
            </Button>
          </>
        }
      />
    </PageContainer>
  );
}
