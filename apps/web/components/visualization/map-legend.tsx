"use client";
import { cn } from "@/lib/cn";
import { ACCENT, GAP, INK, MUTED, OBSERVED, PLUM_STOPS, KPA_PER_PSI, plumColor } from "./map-scales";

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
  /** At least one candidate sits at a different airflow/pressure than the map shows (drawn hollow). */
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
  const l = p.layers;
  const any = Object.values(l).some(Boolean);
  if (!any) return null;
  const showContext = l.context && (p.hasContextEnvelopes || p.hasContextPoints);
  const sliceWord = p.plane === "o2_flow" ? "pressure" : "airflow";
  return (
    <div className={cn("text-[12px] leading-snug", p.className)} aria-label="Map legend" role="group">
      <ul className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-[repeat(auto-fill,minmax(250px,1fr))] sm:gap-x-5">
        {l.observations && (
          <>
            <Item swatch={<circle cx="11" cy="8" r="4.5" fill={OBSERVED} stroke="var(--surface)" strokeWidth="1" />} label="Flame kept burning" />
            <Item swatch={<circle cx="11" cy="8" r="4.5" fill="var(--surface)" stroke={OBSERVED} strokeWidth="1.5" />} label="Flame went out" />
            {p.hasAssumed && (
              <Item
                swatch={
                  <>
                    <circle cx="11" cy="8" r="3.5" fill={OBSERVED} />
                    <circle cx="11" cy="8" r="6.5" fill="none" stroke={OBSERVED} strokeWidth="0.9" strokeOpacity="0.7" strokeDasharray="2 2" />
                  </>
                }
                label="Pressure assumed"
                title="The test did not record its pressure; the documented cabin value is used."
              />
            )}
            {p.hasUnlabelled && (
              <Item swatch={<circle cx="11" cy="8" r="4.5" fill="var(--observed-tint)" stroke={OBSERVED} strokeWidth="1" />} label="Outcome unknown" />
            )}
          </>
        )}
        {l.target && p.hasTarget && (
          <Item
            swatch={
              <>
                <rect x="2" y="2" width="18" height="12" fill={INK} fillOpacity="0.06" stroke={INK} strokeWidth="1.4" strokeDasharray="4 2" />
                <circle cx="11" cy="8" r="3" fill={INK} stroke="var(--surface)" strokeWidth="1" />
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
                  <path d="M11 1 L18 8 L11 15 L4 8 Z" fill={ACCENT} stroke="var(--surface)" />
                  <text x="11" y="11.2" fontSize="8" fill="#fff" textAnchor="middle" fontWeight="700">
                    1
                  </text>
                </>
              }
              label="Next test"
              hint="(number = rank)"
            />
            {p.hasOffSlice && (
              <Item
                swatch={<path d="M11 1 L18 8 L11 15 L4 8 Z" fill="var(--surface)" stroke={ACCENT} strokeWidth="1.5" />}
                label="Hollow diamond"
                hint={`= at a different ${sliceWord} than this map shows`}
                title={`This next test is at another ${sliceWord} than the one this map shows.`}
              />
            )}
          </>
        )}
        {showContext && (
          <Item
            swatch={
              <>
                <rect x="1.5" y="1.5" width="19" height="13" fill="none" stroke={MUTED} strokeOpacity="0.45" strokeWidth="1" strokeDasharray="2 3" />
                <path d="M11 4.5 L14.5 11 H7.5 Z" fill="var(--surface)" stroke={MUTED} strokeOpacity="0.8" strokeWidth="1" />
              </>
            }
            label="Related NASA work"
            hint="(not used by the model)"
          />
        )}
        {l.coverage && (
          <Item
            swatch={
              <>
                <rect x="1" y="1" width="20" height="14" fill="none" stroke={GAP} strokeWidth="1" />
                <path d="M1 15 L15 1 M7 15 L21 1 M1 9 L9 1 M13 15 L21 7" stroke={GAP} strokeWidth="1" />
              </>
            }
            label="Few nearby test results"
            title={
              p.sparseThreshold != null
                ? `The nearest test result is more than ${+p.sparseThreshold.toFixed(2)} steps away (the model's comparison distance; see How it works).`
                : "The nearest test result is beyond the model's comparison distance."
            }
          />
        )}
        {l.prediction && (
          <Item
            swatch={
              <>
                <rect x="1" y="1" width="20" height="14" fill="rgba(23,23,26,0.1)" />
                <path d="M1 12 Q8 4 21 7" stroke={INK} strokeWidth="1.75" fill="none" />
              </>
            }
            label="Model's 50 % line"
            hint="(only where tests support an estimate)"
            title="The model's estimate that a flame keeps burning. Solid line: 50 %. Dashed lines: 10 % and 90 %. A model estimate, not a measured limit."
          />
        )}
        {l.uncertainty && (
          <li className="col-span-2 flex items-center gap-1.5 sm:col-span-full">
            <span className="text-muted">Model uncertainty</span>
            <span className="text-muted">low</span>
            <span className="flex w-20 opacity-[0.72]" role="img" aria-label="Colour scale from low uncertainty (light) to high uncertainty (dark purple)">
              {Array.from({ length: PLUM_STOPS.length * 2 - 1 }, (_, i) => (
                <span key={i} className="h-3 flex-1 border-y border-border" style={{ background: plumColor(i / (PLUM_STOPS.length * 2 - 2)) }} />
              ))}
            </span>
            <span className="text-muted">high</span>
          </li>
        )}
      </ul>
      {l.uncertainty && p.hasHypothetical && <p className="mt-2 text-muted">What-if view: the shading includes a hypothetical test result, not only the fitted model.</p>}
      {p.modelMissing && (
        <p className="mt-2 text-gap-fg">This material has no fitted model, so the estimate and uncertainty layers are not available. Test results are still shown.</p>
      )}
      {p.plane === "o2_pressure" && (
        <p className="mt-2 text-muted">Pressure in kPa. For reference, 101.3 kPa = {(101.325 / KPA_PER_PSI).toFixed(1)} psia (sea level).</p>
      )}
    </div>
  );
}
