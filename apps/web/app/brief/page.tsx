import { Suspense } from "react";
import type { Metadata } from "next";
import { BriefView } from "@/components/brief/brief-view";

export const metadata: Metadata = { title: "Research brief" };

export default function BriefPage() {
  return (
    <Suspense fallback={null}>
      <BriefView />
    </Suspense>
  );
}
