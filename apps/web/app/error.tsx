"use client";

import { PageContainer } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";

/** Route-segment error boundary (not app/global-error.tsx): the header and footer stay in place. */
export default function RouteError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <PageContainer width="reading" className="flex-1">
      <h1 className="sr-only">Something went wrong</h1>
      <div role="alert" data-error-code="internal" className="flex flex-col items-start gap-4 py-10">
        <p className="text-prose font-medium text-fg">Something went wrong.</p>
        <Button variant="primary" onClick={reset}>
          Try again
        </Button>
      </div>
    </PageContainer>
  );
}
