import type { Metadata } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { FindingsView } from "@/components/findings/findings-view";

export const metadata: Metadata = { title: "Findings" };

/** "/findings": what the ISS fire tests show, ranked by code from GET /api/findings. */
export default function FindingsPage() {
  return (
    <AppShell>
      <FindingsView />
    </AppShell>
  );
}
