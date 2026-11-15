"use client";

import type { ApiQuery } from "@/hooks/api";
import type { MethodologyResponse } from "@/lib/types";
import type { ExtValidation } from "./types";
import { Disclosure } from "@/components/ui/disclosure";
import { ExtLink, Facts, Mono, P, QueryBoundary, Section } from "./primitives";

const COMMANDS = `cd services/analysis
uv sync
uv run blindspots build-dataset    # normalize curated records into data/normalized
uv run blindspots train            # fit one model per analysis group, run validation
uv run blindspots retrospective    # acquisition retrospective on held-out experiments
uv run blindspots serve            # start the analysis API
# optional: static snapshot for deployment without the Python service
uv run blindspots export-artifacts --snapshot ../../apps/web/public/snapshot`;

function Detail({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Disclosure tone="strong" className="card px-5 sm:px-6" summaryClassName="flex w-full min-h-14 text-[17px] font-medium tracking-[-0.01em] hover:text-accent" contentClassName="mt-1 space-y-3 pb-4 pl-0 text-fg sm:pl-5" summary={title}>
      {children}
    </Disclosure>
  );
}

const json = (v: unknown): string => (v === null || v === undefined ? "not reported" : JSON.stringify(v));

export function ReproducibilitySection({ methodology, validation }: { methodology: ApiQuery<MethodologyResponse>; validation: ApiQuery<ExtValidation> }) {
  return (
    <Section id="reproducibility" number={5} title="Reproducibility" intro="Rerun it and get the same numbers.">
      <QueryBoundary query={methodology} rows={4}>
        {(m) => {
          const cfg = m.config as unknown as Record<string, unknown>;
          const seeds = (cfg.seeds ?? null) as { cv_seeds?: number[]; seed?: number } | null;
          return (
            <div className="space-y-3">
              <P>
                Every number here is rebuilt from the raw NASA files with a few commands. The same data and settings always give the same results.
                {m.repository_url ? (
                  <>
                    {" "}The code is public: <ExtLink href={m.repository_url}>{m.repository_url}</ExtLink>
                  </>
                ) : (
                  <> No code link is set for this deployment.</>
                )}
              </P>
              <Detail title="Versions and settings">
                <Facts
                  items={[
                    { label: "Dataset version", value: m.versions.dataset_version ?? "not reported" },
                    { label: "Model version", value: m.versions.model_version ?? "not reported" },
                    { label: "Pipeline version", value: m.versions.pipeline_version ?? "not reported" },
                    { label: "API version", value: m.versions.api_version },
                    { label: "Raw data retrieved", value: m.dates.data_retrieved },
                    { label: "Last analysis", value: m.dates.last_analysis ?? "not reported" },
                    { label: "Random seed (model fitting)", value: seeds?.seed !== undefined ? String(seeds.seed) : "not reported" },
                    { label: "Cross-validation seeds", value: seeds?.cv_seeds ? seeds.cv_seeds.join(", ") : "not reported" },
                    { label: "Pressure length scale (fixed)", value: `${json(cfg.pressure_length_scale_default)} ln units; sensitivity ${json(cfg.pressure_length_scale_sensitivity)}` },
                    { label: "Candidate domain", value: json(cfg.candidate_domain) },
                    { label: "Coverage scales", value: json(cfg.coverage_scales) },
                    { label: "Support thresholds", value: json(cfg.support_thresholds) },
                  ]}
                />
                <QueryBoundary query={validation} rows={1}>
                  {(v) => {
                    const cv = v.groups[0]?.cv;
                    return cv ? (
                      <P className="text-xs text-muted">
                        Cross-validation: {cv.scheme}
                        {cv.ci_method ? `; intervals: ${cv.ci_method}` : ""}. Full settings: <Mono>models/{m.versions.model_version ?? "&lt;model_version&gt;"}/manifest.json</Mono>.
                      </P>
                    ) : null;
                  }}
                </QueryBoundary>
              </Detail>
              <Detail title="Commands">
                <pre className="num max-w-[78ch] overflow-x-auto rounded-[var(--radius-lg)] border border-border bg-subtle px-4 py-3 text-[12.5px] leading-relaxed text-fg" tabIndex={0} aria-label="Commands to reproduce the analysis">
                  {COMMANDS}
                </pre>
                <P className="text-xs text-muted">
                  Raw files are checked against SHA-256 hashes. Cell-level sources are in <Mono>data/curation</Mono>.
                </P>
              </Detail>
            </div>
          );
        }}
      </QueryBoundary>
    </Section>
  );
}
