import type { Metadata } from "next";
import Link from "next/link";
import { PageContainer } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <PageContainer width="reading" className="flex-1">
      <h1 className="sr-only">Page not found</h1>
      <div data-error-code="not_found" className="flex flex-col items-start gap-4 py-10">
        <p className="text-prose font-medium text-fg">This page does not exist.</p>
        <Button asChild variant="primary">
          <Link href="/">Back to Cabins</Link>
        </Button>
      </div>
    </PageContainer>
  );
}
