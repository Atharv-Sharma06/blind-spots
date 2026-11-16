import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";

export const metadata: Metadata = { title: "Page not found" };

/** 404: the landing header and footer around one white card, on the cream canvas. */
export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-1 flex-col page-gradient text-fg">
      <SiteHeader />
      <main id="main" tabIndex={-1} className="flex flex-1 items-center justify-center px-4 py-10 outline-none">
        <h1 className="sr-only">Page not found</h1>
        <div data-error-code="not_found" className="flex w-full max-w-md flex-col items-start gap-5 card p-7 md:p-9">
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">Not found</p>
          <p aria-hidden className="text-[56px] font-medium leading-none tracking-[-0.03em] text-fg">
            404
          </p>
          <p className="text-prose font-medium text-fg">This page does not exist.</p>
          <Link
            href="/cabins"
            className="inline-flex min-h-11 items-center rounded-full bg-cta px-6 py-1.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-on-cta transition-[filter] hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Back to Cabins
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
