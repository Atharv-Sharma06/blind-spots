import type { Metadata } from "next";
import { MethodologyPage } from "@/components/methodology/methodology-page";

export const metadata: Metadata = { title: "How it works" };

export default function Page() {
  return <MethodologyPage />;
}
