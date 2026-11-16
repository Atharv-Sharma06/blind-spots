import { Suspense } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { HomePage } from "@/components/home/home-page";
import { HomeFallback } from "@/components/home/home-fallback";
import { AskCabinAir } from "@/components/ask/ask-cabin-air";

/** "/cabins" = Cabins: pick a cabin, see whether the ISS tests cover its air, see what to test next. */
export default function CabinsPage() {
  return (
    <AppShell>
      <Suspense fallback={<HomeFallback />}>
        <HomePage />
      </Suspense>
      <div className="mx-auto w-full max-w-[1240px] px-4 pb-16 md:px-8">
        <AskCabinAir id="ask" />
      </div>
    </AppShell>
  );
}
