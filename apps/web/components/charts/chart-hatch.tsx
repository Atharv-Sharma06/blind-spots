import { useId } from "react";
import { CHART } from "./chart-utils";

/** Diagonal-stripe fill for comparison marks (Reference C hatched bars). Returns the <defs> node and the fill URL. */
export function useHatch(): { defs: React.ReactNode; fill: string } {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const pid = `hatch-${id}`;
  return {
    fill: `url(#${pid})`,
    defs: (
      <defs>
        <pattern id={pid} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="6" height="6" fill="var(--surface)" />
          <line x1="0" y1="0" x2="0" y2="6" stroke={CHART.hatch} strokeWidth="2" />
        </pattern>
      </defs>
    ),
  };
}
