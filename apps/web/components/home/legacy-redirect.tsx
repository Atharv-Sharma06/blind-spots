"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";

/** Query params the Cabins page understands. Anything else is an old Explorer link. */
const HOME_PARAMS = new Set(["cabin", "material", "demo"]);

/** Where an old query string belongs: the Cabins tool when every key is a Cabins key, otherwise the Explorer. */
function legacyTarget(params: URLSearchParams): "/cabins" | "/explore" {
  return Array.from(params.keys()).every((k) => HOME_PARAMS.has(k)) ? "/cabins" : "/explore";
}

/**
 * On the Cabins page (/cabins): old links such as /?group=...&target=...&plane=... belong to the Explorer, now at
 * /explore. Returns true while such a URL is being forwarded (client-side, same query string) so the page can show a
 * short "Opening the Explorer" note instead of flashing the Cabins page.
 */
export function useLegacyRedirect(): boolean {
  const router = useRouter();
  const params = useSearchParams();
  const legacy = React.useMemo(() => Array.from(params.keys()).some((k) => !HOME_PARAMS.has(k)), [params]);
  React.useEffect(() => {
    if (legacy) router.replace(`/explore?${params.toString()}${window.location.hash}`);
  }, [legacy, params, router]);
  return legacy;
}

/**
 * Mounted on the landing page ("/"). Links made before the landing page existed carried their query on "/":
 * `?cabin=` / `?material=` / `?demo=` go to the Cabins tool (/cabins), any other query (group, target, plane, ...)
 * to the Explorer (/explore). The query string and hash are kept. Reads the live URL in an effect, so it needs no
 * Suspense boundary and renders nothing.
 */
export function LegacyRedirect(): null {
  const router = useRouter();
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (Array.from(params.keys()).length === 0) return;
    router.replace(`${legacyTarget(params)}?${params.toString()}${window.location.hash}`);
  }, [router]);
  return null;
}
