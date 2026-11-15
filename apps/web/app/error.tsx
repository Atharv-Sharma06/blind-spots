"use client";

import { PageContainer } from "@/components/layout/page-container";
import { ErrorState } from "@/components/ui/error-state";

/** Route-segment error boundary (not app/global-error.tsx): the header and footer stay in place. */
export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <PageContainer width="reading" className="flex-1">
      <h1 className="sr-only">Something went wrong</h1>
      <ErrorState
        code="internal"
        description="This page hit an unexpected error. Retry; if it persists, reload the page."
        message={error.digest ? `Reference ${error.digest}` : null}
        onRetry={reset}
      />
    </PageContainer>
  );
}
