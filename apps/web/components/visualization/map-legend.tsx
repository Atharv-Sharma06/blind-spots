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
          {p.hasAssumed && <Item
            swatch={
              <>
                <circle cx="11" cy="8" r="3.5" fill={OBSERVED} />
                <circle cx="11" cy="8" r="6.5" fill="none" stroke={OBSERVED} strokeWidth="0.75" strokeOpacity="0.6" strokeDasharray="2 2" />
              </>
            }
            title="Dashed ring: pressure assumed"
          >
            not recorded; the documented cabin value is used
          </Item>}
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
              ? `nearest comparable observation more than ${+p.sparseThreshold.toFixed(2)} reference distance away; thin amber line marks the threshold`
              : "nearest observation beyond the sparse threshold (reference distance)"}
          </Item>
        </Group>
      )}
      {l.prediction && (
        <Group name="Prediction">
          <Item
            swatch={
              <>
                <rect x="1" y="1" width="20" height="14" fill="rgba(23,23,26,0.1)" />
                <path d="M1 12 Q8 4 21 7" stroke={INK} strokeWidth="1.75" fill="none" />
                <path d="M1 15 Q9 9 21 12" stroke={INK} strokeWidth="1" strokeDasharray="3 2" strokeOpacity="0.6" fill="none" />
              </>
            }
            title="Model P(flame sustained), 0 to 1: supported region only"
          >
            Solid line: the model&apos;s 50 % line (p = 0.5); dashed: 0.1 and 0.9. Grey wash darkens with p. Nothing is drawn where the
            evidence does not support an estimate. A model estimate, not a measured flammability limit.
          </Item>
        </Group>
      )}
      {l.uncertainty && (
        <Group name="Model uncertainty">
          <li>
            <div className="flex opacity-[0.72]" role="img" aria-label="Plum scale from 0 (posterior as certain as it can be relative to prior) to 1 (no information gained over prior)">
              {Array.from({ length: PLUM_STOPS.length * 2 - 1 }, (_, i) => (
                <span key={i} className="h-3 flex-1 border-y border-border" style={{ background: plumColor(i / (PLUM_STOPS.length * 2 - 2)) }} />
              ))}
            </div>
            <div className="mt-0.5 flex justify-between font-mono text-[11px] tabular-nums text-muted">
              {plumTicks.map((t) => (
                <span key={t}>{t}</span>
              ))}
            </div>
            <div className="mt-1 text-fg">Knowledge uncertainty (latent std ratio, dimensionless)</div>
            <div className="text-muted">0 = pinned down by the data; 1 = no better than the prior.</div>
            {p.hasHypothetical && <div className="text-muted">Showing a what-if surface (hypothetical added observation), not the fitted model.</div>}
          </li>
        </Group>
      )}
      {l.target && p.hasTarget && (
        <Group name="Target atmosphere">
          <Item
            swatch={
              <>
                <rect x="2" y="2" width="18" height="12" fill="none" stroke={INK} strokeWidth="1.4" strokeDasharray="4 2" />
                <path d="M11 4 V12 M7 8 H15" stroke={INK} strokeWidth="1" />
              </>
            }
            title="Black dashed outline: target range; cross = nominal"
          />
        </Group>
      )}
      {l.candidates && p.hasCandidates && (
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
            title="Teal diamond: research candidate"
          >
            number = rank by expected uncertainty reduction; hollow = off this slice; &quot;1, 3&quot; = candidates at the same point
          </Item>
        </Group>
      )}
      {l.context && (p.hasContextEnvelopes || p.hasContextPoints) && (
        <Group name="Context (not modelled)">
          {p.hasContextEnvelopes && (
            <Item
              swatch={<rect x="2" y="2" width="18" height="12" fill="none" stroke={MUTED} strokeOpacity="0.6" strokeWidth="1" strokeDasharray="2 3" />}
              title="Grey dashed box: context envelope"
            >
              related NASA work, not integrated
            </Item>
          )}
          {p.hasContextPoints && (
            <Item swatch={<path d="M11 4 L15 11 H7 Z" fill="#fff" stroke={MUTED} strokeWidth="1" />} title="Grey triangle: context test">
              other apparatus or duration, not modelled
            </Item>
          )}
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
