"use client";

import { usePathname } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { PageContainer } from "@/components/layout/page-container";

/**
 * Route-segment error boundary (not app/global-error.tsx). On "/" the root layout still supplies the header and
 * footer; on app pages the sidebar shell is put back around the message.
 */
export default function RouteError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const pathname = usePathname();
  const card = (
    <PageContainer width="reading" className="flex flex-1 items-center justify-center">
      <h1 className="sr-only">Something went wrong</h1>
      <div role="alert" data-error-code="internal" className="flex w-full max-w-md flex-col items-start gap-5 card p-7 md:p-9">
        <span aria-hidden className="inline-flex size-10 items-center justify-center rounded-full bg-warn-tint text-warn">
          <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M10 5.5v5.5M10 14.2v.3" />
            <circle cx="10" cy="10" r="8" />
          </svg>
        </span>
        <p className="text-prose font-medium text-fg">Something went wrong.</p>
        <button
          type="button"
          onClick={reset}
          className="inline-flex min-h-11 items-center pill-ink px-6 py-1.5 text-[16px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Try again
        </button>
      </div>
    </PageContainer>
  );
  return pathname === "/" ? card : <AppShell>{card}</AppShell>;
}
