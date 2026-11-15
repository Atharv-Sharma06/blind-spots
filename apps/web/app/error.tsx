"use client";

import { PageContainer } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";

/** Route-segment error boundary (not app/global-error.tsx): the header and footer stay in place. */
export default function RouteError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <PageContainer width="reading" className="flex flex-1 items-center justify-center">
      <h1 className="sr-only">Something went wrong</h1>
      <div role="alert" data-error-code="internal" className="card flex w-full max-w-md flex-col items-start gap-5 p-7 md:p-9">
        <span aria-hidden className="inline-flex size-10 items-center justify-center rounded-full bg-warn-tint text-warn">
          <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M10 5.5v5.5M10 14.2v.3" />
            <circle cx="10" cy="10" r="8" />
          </svg>
        </span>
        <p className="text-prose font-medium text-fg">Something went wrong.</p>
        <Button variant="primary" onClick={reset}>
          Try again
        </Button>
      </div>
    </PageContainer>
  );
}
