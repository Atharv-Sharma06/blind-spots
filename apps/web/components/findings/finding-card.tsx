"use client";

import { Reveal } from "@/components/ui/reveal";
import Link from "next/link";
import { ProvenanceTag } from "@/components/ui/provenance-tag";
import { cn } from "@/lib/cn";
import type { FindingMaterial, PillarFilter } from "./types";

const FOCUS =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

/** Numbers to at most 3 significant digits (the API already rounds; this only trims trailing zeros). */
export function sig3(v: number): string {
  return String(Number(v.toPrecision(3)));
}

const PILLAR_WORD = {
  prevention: "Prevention",
  suppression: "Suppression",
} as const;

function uniqueSorted(lists: string[][]): string[] {
  return Array.from(new Set(lists.flat())).sort();
}

/** One ranked material: rank, lowest oxygen that kept a flame burning, the API's sentences, model status and evidence ids. */
export function FindingCard({
  m,
  pillar,
}: {
  m: FindingMaterial;
  pillar: PillarFilter;
}) {
  const ink = m.rank === 1;
  const p = m.lowest_o2_burning;
  const shown =
    pillar === "prevention" || pillar === "suppression"
      ? m.findings.filter((f) => f.pillar === pillar)
      : m.findings;
  const experimentIds = uniqueSorted([
    p?.experiment_ids ?? [],
    ...m.findings.map((f) => f.experiment_ids),
  ]);
  const observationIds = uniqueSorted([
    p?.observation_ids ?? [],
    ...m.findings.map((f) => f.observation_ids),
  ]);

  return (
    <Reveal
      as="li"
      data-testid="finding-card"
      data-group={m.group_id}
      className={cn(
        ink ? "card-ink" : "card",
        "flex flex-col gap-4 p-5 sm:p-7",
      )}
    >
      <div className="flex items-start gap-4">
        <div
          className="min-w-12 text-[40px] font-medium leading-none tracking-[-0.03em] tabular-nums"
          aria-label={`Rank ${m.rank}`}
        >
          {m.rank}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-title text-fg break-words">{m.label}</h3>
          <p className="mt-1 text-ui text-muted">
            {[
              `${m.n_observations} ISS test results`,
              `${m.n_experiments} experiments`,
              m.campaigns.join(", ") || null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
        <span className="text-ui text-muted">
          Lowest oxygen that kept a flame burning
        </span>
        {p ? (
          <>
            <span className="text-[28px] font-medium leading-none tabular-nums text-fg">
              {sig3(p.oxygen_percent)}%
            </span>
            <ProvenanceTag
              kind={p.o2_basis === "interpolated" ? "derived" : "measured"}
              title={
                p.o2_basis === "interpolated"
                  ? "Oxygen interpolated between recorded readings"
                  : undefined
              }
            />
            {p.pressure_basis === "assumed" ? (
              <span className="inline-flex items-center gap-1.5 text-ui text-muted">
                pressure
                <ProvenanceTag
                  kind="assumed"
                  title="Pressure not recorded; sea-level pressure assumed"
                />
              </span>
            ) : null}
          </>
        ) : (
          <span className="text-prose font-medium text-fg">
            No test of this material kept burning
          </span>
        )}
      </div>

      {shown.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {shown.map((f) => (
            <li
              key={f.id}
              data-testid="finding-sentence"
              data-pillar={f.pillar}
              className="border-t border-border pt-3"
            >
              <p className="eyebrow mb-1 text-muted">{PILLAR_WORD[f.pillar]}</p>
              <p className="text-prose text-fg">{f.headline}</p>
              <p className="mt-1 text-ui text-muted">{f.interpretation}</p>
            </li>
          ))}
        </ul>
      ) : null}

      <p className="text-ui text-fg">
        <span className="font-medium">Model:</span>{" "}
        {m.model_status === "modeled"
          ? "estimates"
          : `abstains${m.model_reason ? ` (${m.model_reason})` : ""}`}
      </p>

      <details className="group" data-testid="finding-evidence">
        <summary
          className={cn(
            "inline-flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-full border border-border px-4 text-ui font-medium text-fg [&::-webkit-details-marker]:hidden",
            FOCUS,
          )}
        >
          Where this comes from
        </summary>
        <div className="mt-3 flex flex-col gap-3 text-ui">
          {experimentIds.length > 0 ? (
            <div>
              <p className="text-muted">
                ISS experiments (open in Experiments)
              </p>
              <ul className="mt-1 flex flex-wrap gap-2">
                {experimentIds.map((id) => (
                  <li key={id}>
                    <Link
                      href={`/experiments?id=${encodeURIComponent(id)}`}
                      data-testid="evidence-experiment"
                      className={cn(
                        "inline-flex min-h-10 items-center rounded-lg border border-border px-3 font-mono text-label text-fg underline-offset-4 hover:underline",
                        FOCUS,
                      )}
                    >
                      {id}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {observationIds.length > 0 ? (
            <div>
              <p className="text-muted">Test results (observation ids)</p>
              <p className="mt-1 break-all font-mono text-label text-fg">
                {observationIds.join(", ")}
              </p>
            </div>
          ) : null}
          {experimentIds.length === 0 && observationIds.length === 0 ? (
            <p className="text-muted">
              No record ids listed for this material.
            </p>
          ) : null}
        </div>
      </details>
    </Reveal>
  );
}
