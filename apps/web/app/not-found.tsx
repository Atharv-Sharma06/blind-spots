import Link from "next/link";
import { PageContainer } from "@/components/layout/page-container";
import { ErrorState } from "@/components/ui/error-state";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <PageContainer width="reading" className="flex-1">
      <h1 className="sr-only">Page not found</h1>
      <ErrorState
        code="not_found"
        message="This page does not exist."
        action={
          <Button asChild size="sm">
            <Link href="/">Back to Explore</Link>
          </Button>
        }
      />
    </PageContainer>
  );
}
