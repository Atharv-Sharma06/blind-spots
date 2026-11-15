"use client";

import { PageContainer } from "@/components/layout/page-container";
import { ErrorState } from "@/components/ui/error-state";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <PageContainer width="reading" className="flex-1">
      <ErrorState code="internal" message={error.digest ? `Reference ${error.digest}` : null} onRetry={reset} />
    </PageContainer>
  );
}
