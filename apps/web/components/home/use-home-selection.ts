"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { DEFAULT_CABIN } from "./cabins";

export interface HomeSelection {
  /** Selected cabin (atmosphere profile id). Defaults to the Exploration Atmosphere: the blind spot is the story. */
  cabin: string;
  /** Selected material (analysis group id). null means "the API default group". */
  material: string | null;
  setCabin(id: string): void;
  setMaterial(id: string | null): void;
}

/**
 * URL-backed selection for the Cabins page (`?cabin=`, `?material=`). Updates use router.replace with
 * scroll: false so nothing reloads or jumps. Other query params (for example `demo`) are preserved.
 * The material stays selected when the cabin changes, so one material can be compared across cabins.
 */
export function useHomeSelection(): HomeSelection {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const cabin = params.get("cabin") || DEFAULT_CABIN;
  const material = params.get("material") || null;

  const write = React.useCallback(
    (key: "cabin" | "material", value: string | null) => {
      // Read the live URL, not the render-time params, so two quick updates cannot overwrite each other.
      const next = new URLSearchParams(window.location.search);
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router],
  );

  const setCabin = React.useCallback((id: string) => write("cabin", id), [write]);
  const setMaterial = React.useCallback((id: string | null) => write("material", id), [write]);

  return React.useMemo(() => ({ cabin, material, setCabin, setMaterial }), [cabin, material, setCabin, setMaterial]);
}
