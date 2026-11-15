import { kpaToPsia } from "@/lib/format";
import type { AtmosphereProfile } from "@/lib/types";

/** Plain-language "air" of a cabin, built only from the profile's own numbers. */
export interface CabinAir {
  /** "34 % oxygen", "up to 30 % oxygen", or null when the profile states no oxygen value. */
  oxygen: string | null;
  /** "56.5 kPa" (one decimal below 100, none above), or null. */
  pressure: string | null;
  /** "8.2 psia", or null. */
  psia: string | null;
}

const trim = (v: number, digits = 1): string => String(Number(v.toFixed(digits)));

export const fmtOxygenPct = (v: number): string => `${trim(v)} %`;
export const fmtKpaPlain = (v: number): string => (v >= 100 ? `${Math.round(v)} kPa` : `${trim(v)} kPa`);
export const fmtPsiaPlain = (v: number): string => `${trim(v)} psia`;

export function cabinAir(p: Pick<AtmosphereProfile, "oxygen_percent" | "total_pressure_kpa" | "total_pressure_psia">): CabinAir {
  const o2 = p.oxygen_percent;
  const oxygen = o2.nominal != null ? `${fmtOxygenPct(o2.nominal)} oxygen` : o2.max != null ? `up to ${fmtOxygenPct(o2.max)} oxygen` : null;
  const kpa = p.total_pressure_kpa.nominal ?? p.total_pressure_kpa.max ?? null;
  const psia = p.total_pressure_psia?.nominal ?? (kpa != null ? kpaToPsia(kpa) : null);
  return {
    oxygen,
    pressure: kpa != null ? fmtKpaPlain(kpa) : null,
    psia: psia != null ? fmtPsiaPlain(psia) : null,
  };
}
