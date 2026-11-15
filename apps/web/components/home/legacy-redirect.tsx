"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";

/** Query params the Cabins page understands. Anything else is an old Explorer link. */
const HOME_PARAMS = new Set(["cabin", "material", "demo"]);

/**
 * Old links such as /?group=...&target=...&plane=... belong to the Explorer, now at /explore.
 * Returns true while such a URL is being forwarded (client-side, same query string) so the page can show a
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
