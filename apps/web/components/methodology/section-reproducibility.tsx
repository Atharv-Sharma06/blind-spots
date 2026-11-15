"use client";

import type { ApiQuery } from "@/hooks/api";
import type { MethodologyResponse } from "@/lib/types";
import type { ExtValidation } from "./types";
import { ExtLink, Facts, Mono, P, QueryBoundary, Section, Sub } from "./primitives";

const COMMANDS = `cd services/analysis
uv sync
uv run blindspots build-dataset    # normalize curated records into data/normalized
uv run blindspots train            # fit one model per analysis group, run validation
uv run blindspots retrospective    # acquisition retrospective on held-out experiments
uv run blindspots serve            # start the analysis API
# optional: static snapshot for deployment without the Python service
uv run blindspots export-artifacts --snapshot ../../apps/web/public/snapshot`;

const json = (v: unknown): string => (v === null || v === undefined ? "not reported" : JSON.stringify(v));

export function ReproducibilitySection({ methodology, validation }: { methodology: ApiQuery<MethodologyResponse>; validation: ApiQuery<ExtValidation> }) {
  return (
    <Section id="reproducibility" number={5} title="Reproducibility" intro="Versions, seeds and commands that regenerate every number on this page from the raw NASA files.">
      <QueryBoundary query={methodology} rows={4}>
        {(m) => {
          const cfg = m.config as unknown as Record<string, unknown>;
          const seeds = (cfg.seeds ?? null) as { cv_seeds?: number[]; seed?: number } | null;
          return (
            <div className="space-y-6">
              <Sub title="Versions">
                <Facts
                  items={[
                    { label: "Dataset version", value: m.versions.dataset_version ?? "not reported" },
                    { label: "Model version", value: m.versions.model_version ?? "not reported" },
                    { label: "Pipeline version", value: m.versions.pipeline_version ?? "not reported" },
                    { label: "API version", value: m.versions.api_version },
                    { label: "Raw data retrieved", value: m.dates.data_retrieved },
                    { label: "Last analysis", value: m.dates.last_analysis ?? "not reported" },
                  ]}
                />
                <P className="text-muted">
                  The dataset version is a hash of the normalized content; the model version combines it with a hash of the training configuration, so identical data and configuration give identical versions.
                </P>
              </Sub>
              <Sub title="Training and validation configuration">
                <Facts
                  items={[
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
                      <P className="text-muted">
                        Cross-validation: {cv.scheme}
                        {cv.ci_method ? `; intervals: ${cv.ci_method}` : ""}. The complete training configuration (restarts, bootstrap and permutation counts, priors) is stored in the model manifest in the repository under <Mono>models/{m.versions.model_version ?? "&lt;model_version&gt;"}/manifest.json</Mono>.
                      </P>
                    ) : null;
                  }}
                </QueryBoundary>
              </Sub>
              <Sub title="Commands">
                <pre className="num max-w-[78ch] overflow-x-auto rounded-md border border-border bg-surface px-4 py-3 text-[12.5px] leading-relaxed" tabIndex={0} aria-label="Commands to reproduce the analysis">
                  {COMMANDS}
                </pre>
                <P className="text-muted">
                  Raw NASA files are fetched through the PSI web service and checked against SHA-256 hashes in the raw-file manifest; the interpretation tables with cell-level provenance are in the repository under <Mono>data/curation</Mono>.
                </P>
              </Sub>
              <Sub title="Repository">
                {m.repository_url ? (
                  <P>
                    <ExtLink href={m.repository_url}>{m.repository_url}</ExtLink>
                  </P>
                ) : (
                  <P className="text-muted">No repository URL is configured for this deployment.</P>
                )}
              </Sub>
            </div>
          );
        }}
      </QueryBoundary>
    </Section>
  );
}
