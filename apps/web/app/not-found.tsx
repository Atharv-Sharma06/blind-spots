import type { Metadata } from "next";
import Link from "next/link";
import { PageContainer } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <PageContainer width="reading" className="flex flex-1 items-center justify-center">
      <h1 className="sr-only">Page not found</h1>
      <div data-error-code="not_found" className="card flex w-full max-w-md flex-col items-start gap-5 p-7 md:p-9">
        <p aria-hidden className="dotnum text-[56px] text-fg/90">
          404
        </p>
        <p className="text-prose font-medium text-fg">This page does not exist.</p>
        <Button asChild variant="primary">
          <Link href="/cabins">Back to Cabins</Link>
        </Button>
      </div>
    </PageContainer>
  );
}
