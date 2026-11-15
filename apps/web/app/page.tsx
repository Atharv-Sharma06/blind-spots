import { Suspense } from "react";
import { LegacyRedirect } from "@/components/home/legacy-redirect";
import { Landing } from "@/components/landing/landing";

/** "/" = the landing page. The Cabins tool lives at /cabins; old query links are forwarded by LegacyRedirect. */
export default function Page() {
  return (
    <>
      <Suspense fallback={null}>
        <LegacyRedirect />
      </Suspense>
      <Landing />
    </>
  );
}
