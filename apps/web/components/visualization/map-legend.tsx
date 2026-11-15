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
  /** Prediction or uncertainty requested but the group has no model grid. */
  modelMissing?: boolean;
  className?: string;
}

function Swatch({ children }: { children: React.ReactNode }) {
  return (
    <svg width="22" height="16" viewBox="0 0 22 16" aria-hidden className="shrink-0">
      {children}
    </svg>
  );
}

function Item({ swatch, title, children }: { swatch: React.ReactNode; title: string; children?: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <Swatch>{swatch}</Swatch>
      <span className="min-w-0">
        <span className="text-fg">{title}</span>
        {children ? <span className="block text-muted">{children}</span> : null}
      </span>
    </li>
  );
}

function Group({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <section className="min-w-0">
      <h3 className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted">{name}</h3>
      <ul className="space-y-1.5">{children}</ul>
    </section>
  );
}

export default function MapLegend(p: MapLegendProps) {
  const l = p.layers;
  const any = Object.values(l).some(Boolean);
  if (!any) return null;
  const plumTicks = [0, 0.25, 0.5, 0.75, 1];
  const kpa = [50, 70, 101.325];
  return (
    <div className={cn("grid gap-x-8 gap-y-4 text-[12px] leading-snug sm:grid-cols-2 lg:grid-cols-3", p.className)} aria-label="Map legend" role="group">
      {l.observations && (
        <Group name="Observed (integrated records)">
          <Item swatch={<circle cx="11" cy="8" r="4.5" fill={OBSERVED} stroke="#fff" strokeWidth="1" />} title="Flame sustained" />
          <Item swatch={<circle cx="11" cy="8" r="4.5" fill="#fff" stroke={OBSERVED} strokeWidth="1.5" />} title="Flame not sustained" />
          <Item
            swatch={
              <>
                <circle cx="11" cy="8" r="3.5" fill={OBSERVED} />
                <circle cx="11" cy="8" r="6.5" fill="none" stroke={OBSERVED} strokeWidth="1" strokeDasharray="2 2" />
              </>
            }
            title="Dashed outer ring: pressure assumed"
          >
            {p.hasAssumed ? "not measured; a documented value was assumed" : "none in view"}
          </Item>
          {p.hasUnlabelled && (
            <Item swatch={<circle cx="11" cy="8" r="4.5" fill="#eef3fd" stroke={OBSERVED} strokeWidth="1" />} title="Outcome not determined" />
          )}
        </Group>
      )}
      {l.coverage && (
        <Group name="Coverage gap">
          <Item
            swatch={
              <>
                <rect x="1" y="1" width="20" height="14" fill="none" stroke={GAP} strokeWidth="1" />
                <path d="M1 15 L15 1 M7 15 L21 1 M1 9 L9 1 M13 15 L21 7" stroke={GAP} strokeWidth="1" />
              </>
            }
            title="Hatched amber: sparse evidence"
          >
            {p.sparseThreshold != null
              ? `nearest-observation distance > ${+p.sparseThreshold.toFixed(2)} (scaled units); thin amber line marks the threshold`
              : "nearest-observation distance above the sparse threshold"}
          </Item>
        </Group>
      )}
      {l.prediction && (
        <Group name="Prediction">
          <Item
            swatch={
              <>
                <rect x="1" y="1" width="20" height="14" fill="rgba(23,23,26,0.1)" />
                <path d="M1 11 Q8 3 21 6" stroke={INK} strokeWidth="1.8" fill="none" />
              </>
            }
            title="Ink contours: p(flame sustained) = 0.1, 0.5, 0.9"
          >
            The thick line (0.5) is the predicted flammability boundary. Neutral wash darkens with p; lighter wash = extrapolation.
          </Item>
          <Item
            swatch={
              <>
                <rect x="1" y="1" width="20" height="14" fill="none" stroke="#b9b6ad" strokeWidth="1" />
                <path d="M1 15 L15 1 M7 15 L21 1 M1 9 L9 1 M13 15 L21 7" stroke="#b9b6ad" strokeWidth="1" />
              </>
            }
            title="Grey hatch: no supported estimate"
          >
            The model withholds a prediction here (insufficient evidence).
          </Item>
        </Group>
      )}
      {l.uncertainty && (
        <Group name="Model uncertainty">
          <li>
            <div className="flex" role="img" aria-label="Plum scale from 0 (posterior as certain as it can be relative to prior) to 1 (no information gained over prior)">
              {Array.from({ length: PLUM_STOPS.length * 2 - 1 }, (_, i) => (
                <span key={i} className="h-3 flex-1 border-y border-border" style={{ background: plumColor(i / (PLUM_STOPS.length * 2 - 2)) }} />
              ))}
            </div>
            <div className="mt-0.5 flex justify-between font-mono text-[11px] tabular-nums text-muted">
              {plumTicks.map((t) => (
                <span key={t}>{t}</span>
              ))}
            </div>
            <div className="mt-1 text-fg">Posterior / prior latent std</div>
            <div className="text-muted">0 = well constrained by data; 1 = no better than the prior. Dimensionless.</div>
            {p.hasHypothetical && <div className="text-muted">Showing a what-if surface (hypothetical added observation), not the fitted model.</div>}
          </li>
        </Group>
      )}
      {l.target && (
        <Group name="Target atmosphere">
          <Item
            swatch={
              <>
                <rect x="2" y="2" width="18" height="12" fill="none" stroke={INK} strokeWidth="1.4" strokeDasharray="4 2" />
                <path d="M11 4 V12 M7 8 H15" stroke={INK} strokeWidth="1" />
              </>
            }
            title="Dashed ink: target range; cross = nominal"
          >
            {p.hasTarget ? "" : "no target set"}
          </Item>
        </Group>
      )}
      {l.candidates && (
        <Group name="Research candidates">
          <Item
            swatch={
              <>
                <path d="M11 1 L18 8 L11 15 L4 8 Z" fill={ACCENT} stroke="#fff" />
                <text x="11" y="11" fontSize="8" fill="#fff" textAnchor="middle" fontWeight="600">
                  1
                </text>
              </>
            }
            title="Teal diamond: ranked candidate"
          >
            {p.hasCandidates ? "number = rank by expected information" : "none ranked"}
          </Item>
        </Group>
      )}
      {l.context && (
        <Group name="Documented context (not integrated)">
          <Item
            swatch={<rect x="2" y="2" width="18" height="12" fill="none" stroke={MUTED} strokeWidth="1" strokeDasharray="3 2" />}
            title="Grey dashed: documented test conditions"
          >
            {p.hasContextEnvelopes ? "not integrated into the records" : "none provided"}
          </Item>
          <Item swatch={<path d="M11 3 L15 12 H7 Z" fill="#fff" stroke={MUTED} strokeWidth="1.2" />} title="Grey triangle: context point">
            {p.hasContextPoints ? "different apparatus, not used for modelling" : "none provided"}
          </Item>
        </Group>
      )}
      {p.modelMissing && (
        <div className="text-gap-fg sm:col-span-2 lg:col-span-3">
          This group has no fitted model grid, so prediction and uncertainty layers are not available. Coverage and observations are still shown.
        </div>
      )}
      <p className="text-muted sm:col-span-2 lg:col-span-3">
        {p.plane === "o2_flow"
          ? "Axes: oxygen (% by volume, linear) against airflow (cm/s, log scale), at the slice pressure noted by the controls."
          : `Axes: oxygen (% by volume) against total pressure in kPa. For reference: ${kpa
              .map((k) => `${+k.toFixed(1)} kPa = ${(k / KPA_PER_PSI).toFixed(1)} psia`)
              .join("; ")}.`}
      </p>
    </div>
  );
}
