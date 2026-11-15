import { Suspense } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { HomePage } from "@/components/home/home-page";
import { HomeFallback } from "@/components/home/home-fallback";

/** "/cabins" = Cabins: pick a cabin, see whether the ISS tests cover its air, see what to test next. */
export default function CabinsPage() {
  return (
    <AppShell>
      <Suspense fallback={<HomeFallback />}>
        <HomePage />
      </Suspense>
    </AppShell>
  );
}
