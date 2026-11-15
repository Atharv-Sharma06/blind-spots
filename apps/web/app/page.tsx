import { Suspense } from "react";
import { HomePage } from "@/components/home/home-page";
import { HomeFallback } from "@/components/home/home-fallback";

/** "/" = Cabins: pick a cabin, see whether the ISS tests cover its air, see what to test next. */
export default function Page() {
  return (
    <Suspense fallback={<HomeFallback />}>
      <HomePage />
    </Suspense>
  );
}
