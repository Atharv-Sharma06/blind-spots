"use client";
import { cn } from "@/lib/cn";
import { useMapTheme } from "./use-map-theme";
import { ACCENT, GAP, GAP_HEX, GUIDE, INK, MUTED, OBSERVED, OBSERVED_TINT, ON_ACCENT, PAPER, TARGET, KPA_PER_PSI, plumColor } from "./map-scales";

export interface MapLegendProps {
  layers: {
    observations: boolean;
    coverage: boolean;
    prediction: boolean;
    uncertainty: boolean;
    target: boolean;
    candidates: boolean;
    context: boolean;
  };
  plane: "o2_flow" | "o2_pressure";
  sparseThreshold?: number | null;
  hasAssumed?: boolean;
  hasUnlabelled?: boolean;
  hasHypothetical?: boolean;
  hasContextEnvelopes?: boolean;
  hasContextPoints?: boolean;
  hasTarget?: boolean;
  hasCandidates?: boolean;
  /** At least one candidate is at a different airflow/pressure than the map shows (drawn hollow). */
  hasOffSlice?: boolean;
  /** Prediction or uncertainty requested but the material has no model grid. */
  modelMissing?: boolean;
  className?: string;
}

/** One legend entry: a 22 px symbol and a few words. Same symbols and words as the Cabins chart. */
function Item({ swatch, label, hint, title }: { swatch: React.ReactNode; label: string; hint?: string; title?: string }) {
  return (
    <li className="flex items-center gap-1.5" title={title}>
      <svg width="22" height="16" viewBox="0 0 22 16" aria-hidden className="shrink-0">
        {swatch}
      </svg>
      <span className="text-fg">
        {label}
        {hint ? <span className="text-muted"> {hint}</span> : null}
      </span>
    </li>
  );
}

export default function MapLegend(p: MapLegendProps) {
  const theme = useMapTheme();
  const l = p.layers;
  const any = Object.values(l).some(Boolean);
  if (!any) return null;
  const showContext = l.context && (p.hasContextEnvelopes || p.hasContextPoints);
  // The grey shading is the page ink at low alpha: darker on the light plot, lighter on the dark plot.
  const shade = theme.dark ? "lighter" : "darker";
  const sliceWord = p.plane === "o2_flow" ? "pressure" : "airflow";
  return (
    <div className={cn("text-[13px] leading-snug", p.className)} aria-label="Map legend" role="group">
      <ul className="flex flex-wrap gap-x-4 gap-y-2">
        {l.observations && (
          <>
            <Item swatch={<circle cx="11" cy="8" r="4.5" fill={OBSERVED} stroke={PAPER} strokeWidth="1.25" />} label="Flame kept burning" />
            <Item swatch={<circle cx="11" cy="8" r="4.5" fill={PAPER} stroke={OBSERVED} strokeWidth="1.5" />} label="Flame went out" />
            {p.hasAssumed && (
              <Item
                swatch={
                  <>
                    <circle cx="11" cy="8" r="3.5" fill={OBSERVED} />
                    <circle cx="11" cy="8" r="6.5" fill="none" stroke={OBSERVED} strokeWidth="0.9" strokeOpacity="0.7" strokeDasharray="2 2" />
                  </>
                }
                label="Pressure assumed"
                title="The test did not record its pressure, so the documented cabin value is used."
              />
            )}
            {p.hasUnlabelled && (
              <Item swatch={<circle cx="11" cy="8" r="4.5" fill={OBSERVED_TINT} stroke={OBSERVED} strokeWidth="1" />} label="Outcome unknown" />
            )}
          </>
        )}
        {l.target && p.hasTarget && (
          <Item
            swatch={
              <>
                <rect x="2" y="2" width="18" height="12" fill={TARGET} fillOpacity="0.05" stroke={TARGET} strokeOpacity="0.9" strokeWidth="1.4" strokeDasharray="4 2" />
                <circle cx="11" cy="8" r="3" fill={TARGET} stroke={PAPER} strokeWidth="1.25" />
              </>
            }
            label="This cabin"
          />
        )}
        {l.candidates && p.hasCandidates && (
          <>
            <Item
              swatch={
                <>
                  <path d="M11 1 L18 8 L11 15 L4 8 Z" fill={ACCENT} stroke={PAPER} strokeWidth="1.25" />
                  <text x="11" y="11.2" fontSize="8" fill={ON_ACCENT} textAnchor="middle" fontWeight="700">
                    1
                  </text>
                </>
              }
              label="Research candidate"
            />
            {p.hasOffSlice && (
              <Item
                swatch={<path d="M11 1 L18 8 L11 15 L4 8 Z" fill={PAPER} stroke={ACCENT} strokeWidth="1.5" />}
                label={`Candidate at other ${sliceWord}`}
                title={`This research candidate is at a different ${sliceWord} than this map shows.`}
              />
            )}
          </>
        )}
        {showContext && (
          <Item
            swatch={
              <>
                <rect x="1.5" y="1.5" width="19" height="13" fill="none" stroke={MUTED} strokeOpacity="0.5" strokeWidth="1" strokeDasharray="2 3" />
                <path d="M11 4.5 L14.5 11 H7.5 Z" fill={PAPER} stroke={MUTED} strokeOpacity="0.85" strokeWidth="1" />
              </>
            }
            label="Related NASA work"
            hint="(not in the model)"
          />
        )}
        {l.coverage && (
          <Item
            swatch={
              <>
                <rect x="1" y="1" width="20" height="14" fill={PAPER} stroke={GAP} strokeWidth="1" />
                <path d="M1 15 L15 1 M7 15 L21 1 M1 9 L9 1 M13 15 L21 7" stroke={GAP_HEX} strokeWidth="1.25" />
              </>
            }
            label="Few nearby tests"
            title={
              p.sparseThreshold != null
                ? `The nearest ISS test is more than ${+p.sparseThreshold.toFixed(2)} steps away.`
                : "The nearest ISS test is far away."
            }
          />
        )}
        {l.prediction && (
          <Item
            swatch={
              <path d="M1 12 Q8 4 21 7" stroke={INK} strokeWidth="1.75" fill="none" />
            }
            label="Model's 50 % line"
            title="The model's estimate that a flame keeps burning. Solid line: 50 %. Dashed lines: 10 % and 90 %. An estimate, not a measured limit."
          />
        )}
        {l.prediction && (
          <Item
            swatch={
              <>
                <rect x="1" y="1" width="6.67" height="14" fill={INK} fillOpacity="0.05" />
                <rect x="7.67" y="1" width="6.67" height="14" fill={INK} fillOpacity="0.15" />
                <rect x="14.33" y="1" width="6.67" height="14" fill={INK} fillOpacity="0.25" />
                <rect x="1" y="1" width="20" height="14" fill="none" stroke={GUIDE} strokeOpacity="0.22" strokeWidth="1" />
              </>
            }
            label="Grey: chance it burns"
            hint={`(${shade} = higher; no grey = no estimate)`}
            title={`Grey shading is the model's estimated chance that a flame keeps burning. ${theme.dark ? "Lighter" : "Darker"} means a higher chance. Where the model has no estimate, the map is not shaded.`}
          />
        )}
        {l.uncertainty && (
          <li className="flex basis-full items-center gap-1.5">
            <span className="text-fg">Uncertainty</span>
            <span className="text-muted">low</span>
            <span className="flex w-20" style={{ opacity: theme.uncAlpha }} role="img" aria-label={theme.dark ? "Colour scale from low uncertainty (dark) to high uncertainty (light purple)" : "Colour scale from low uncertainty (light) to high uncertainty (dark purple)"}>
              {Array.from({ length: theme.plum.length * 2 - 1 }, (_, i) => (
                <span key={i} className="h-3 flex-1 border-y border-border" style={{ background: plumColor(i / (theme.plum.length * 2 - 2), theme.plum) }} />
              ))}
            </span>
            <span className="text-muted">high</span>
          </li>
        )}
      </ul>
      {l.uncertainty && p.hasHypothetical && <p className="mt-2 text-muted">What-if: the shading includes a hypothetical test result.</p>}
      {p.modelMissing && (
        <p className="mt-2 text-gap-fg">No model for this material. Test results are still shown.</p>
      )}
      {p.plane === "o2_pressure" && (
        <p className="mt-2 text-muted">Pressure in kPa. Sea level is 101.3 kPa ({(101.325 / KPA_PER_PSI).toFixed(1)} psia).</p>
      )}
    </div>
  );
}
