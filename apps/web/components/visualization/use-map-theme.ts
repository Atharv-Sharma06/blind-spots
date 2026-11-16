"use client";
import { useSyncExternalStore } from "react";
import { LIGHT_MAP_THEME, resolveMapTheme, type MapTheme } from "./map-scales";

/* Keeps one MapTheme object per distinct set of token values, so the snapshot is stable between renders. */
let cached: { sig: string; theme: MapTheme } | null = null;

function snapshot(): MapTheme {
  const r = resolveMapTheme();
  if (!cached || cached.sig !== r.sig) cached = r;
  return cached.theme;
}

function subscribe(onChange: () => void): () => void {
  const mo = new MutationObserver(onChange);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class", "style"] });
  const queries: MediaQueryList[] = [];
  try {
    for (const q of ["(prefers-color-scheme: dark)", "print"]) {
      const mq = window.matchMedia(q);
      mq.addEventListener("change", onChange);
      queries.push(mq);
    }
  } catch {
    /* no matchMedia: the data-theme observer still covers the toggle */
  }
  return () => {
    mo.disconnect();
    for (const mq of queries) mq.removeEventListener("change", onChange);
  };
}

/** The map's canvas and legend-ramp colours for the current page theme (light on the server). */
export function useMapTheme(): MapTheme {
  return useSyncExternalStore(subscribe, snapshot, () => LIGHT_MAP_THEME);
}
