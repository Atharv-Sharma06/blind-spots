import type { Metadata } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { MethodologyPage } from "@/components/methodology/methodology-page";

export const metadata: Metadata = { title: "How it works" };

export default function Page() {
  return (
    <AppShell>
      <MethodologyPage />
    </AppShell>
  );
}
