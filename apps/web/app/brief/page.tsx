import { Suspense } from "react";
import type { Metadata } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { BriefView } from "@/components/brief/brief-view";

export const metadata: Metadata = { title: "Research brief" };

export default function BriefPage() {
  return (
    <AppShell>
      <Suspense fallback={null}>
        <BriefView />
      </Suspense>
    </AppShell>
  );
}
