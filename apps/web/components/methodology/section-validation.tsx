"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Callout } from "@/components/ui/callout";
import { Disclosure } from "@/components/ui/disclosure";
import { cn } from "@/lib/cn";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DotPlot, Histogram, LineBands, ReliabilityDiagram, ScatterPlot, type LineSeries } from "@/components/charts";
import type { ApiQuery } from "@/hooks/api";
import type { GroupSummary } from "@/lib/types";
import { fmtCount, fmtFractionPercent } from "@/lib/format";
import type { ExtGroupValidation, ExtScenario, ExtValidation } from "./types";
import { P, QueryBoundary, Section } from "./primitives";
import { STRATEGY_LABEL, blindspotShortfall, modelLabel, scenarioLabel, subgroupLabel, variantLabel, VERDICT_WORD } from "./labels";

const f = (v: number | null | undefined, d = 3): string => (typeof v === "number" && Number.isFinite(v) ? v.toFixed(d) : "—");
const ci = (c: [number, number] | null | undefined, d = 3): string => (c ? `${f(c[0], d)} to ${f(c[1], d)}` : "—");
const signed = (v: number | null | undefined, d = 3): string => (typeof v === "number" ? `${v > 0 ? "+" : ""}${v.toFixed(d)}` : "—");
const pText = (p: number | null | undefined): string => (typeof p !== "number" ? "—" : p < 0.001 ? "< 0.001" : p.toFixed(3));

const METRICS = [
  { value: "brier", label: "Brier", hint: "lower is better" },
  { value: "log_loss", label: "Log loss", hint: "lower is better" },
  { value: "auc", label: "AUC", hint: "higher is better; 0.5 is chance" },
  { value: "ece", label: "ECE", hint: "lower is better; biased upward in small samples" },
] as const;
type MetricKey = (typeof METRICS)[number]["value"];

const STRATEGY_STYLE: Record<string, { label: string; stroke: string; dash?: string }> = {
  evr: { label: STRATEGY_LABEL.evr ?? "evr", stroke: "var(--accent)" },
  uncertainty_sampling: { label: STRATEGY_LABEL.uncertainty_sampling ?? "uncertainty_sampling", stroke: "var(--fg)", dash: "6 3" },
  nearest_gap: { label: STRATEGY_LABEL.nearest_gap ?? "nearest_gap", stroke: "var(--fg)", dash: "1.5 3" },
  random: { label: STRATEGY_LABEL.random ?? "random", stroke: "var(--muted)", dash: "10 3 2 3" },
};
/** AUCs computed on fewer than this many not-sustained rows are not interpretable. */
const MIN_NEG_FOR_AUC = 3;

function Fig({ title, children, note }: { title: string; children: React.ReactNode; note?: React.ReactNode }) {
  return (
    <figure className="min-w-0 rounded-[var(--radius-lg)] border border-white/5 bg-bg/55 p-3 sm:p-4">
      <figcaption className="mb-2 text-[13px] font-medium text-fg">{title}</figcaption>
      {children}
      {note ? <p className="mt-2 max-w-[62ch] text-xs text-muted">{note}</p> : null}
    </figure>
  );
}

function ModelComparison({ g }: { g: ExtGroupValidation }) {
  const [metric, setMetric] = useState<MetricKey>("log_loss");
  const info = METRICS.find((m) => m.value === metric)!;
  const maj = g.cv.models.find((m) => m.name === "majority_class");
  const refVal = maj?.[metric]?.value ?? null;
  const rows = g.cv.models.map((m) => ({ label: modelLabel(m.name), value: m[metric].value, ci: m[metric].ci95, emphasis: m.name === "gp" }));
  const vs = g.cv.gp_vs_majority;
  const verdictFor = (c: { value: number | null; ci95: [number, number] | null } | undefined) => {
    if (!c || c.value === null || !c.ci95) return "not evaluated";
    if (c.ci95[0] <= 0 && c.ci95[1] >= 0) return "not clearly different from the majority-class guess";
    return c.ci95[1] < 0 ? "model clearly better" : "model clearly worse";
  };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <SegmentedControl aria-label="Metric" size="sm" value={metric} onValueChange={(v) => setMetric(v as MetricKey)} options={METRICS.map((m) => ({ value: m.value, label: m.label }))} />
        <span className="text-xs text-muted">{info.hint}. Dot = estimate, bar = 95% range.</span>
      </div>
      <div className="space-y-4">
        <DotPlot
          rows={rows}
          xLabel={`${info.label} (out-of-fold)`}
          reference={refVal !== null ? { value: refVal, label: "majority-class guess" } : null}
          ariaLabel={`${info.label} with 95 percent intervals for each model; majority-class value ${f(refVal)} marked`}
        />
        <Table containerClassName="rounded-[var(--radius-lg)] border-border/70">
          <caption className="sr-only">Cross-validated metrics by model (value and 95 percent interval)</caption>
          <TableHeader>
            <TableRow>
              <TableHead>Model</TableHead>
              <TableHead numeric>Brier</TableHead>
              <TableHead numeric>Log loss</TableHead>
              <TableHead numeric>AUC</TableHead>
              <TableHead numeric>ECE</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {g.cv.models.map((m) => (
              <TableRow key={m.name} className={m.name === "gp" ? "bg-accent-tint/60" : undefined}>
                <TableCell className={m.name === "gp" ? "font-medium" : undefined}>{modelLabel(m.name)}</TableCell>
                {(["brier", "log_loss", "auc", "ece"] as const).map((k) => (
                  <TableCell key={k} numeric className="h-auto whitespace-nowrap py-1 leading-tight">
                    {f(m[k].value)}
                    <div className="text-[11px] text-muted">{ci(m[k].ci95, 2)}</div>
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {vs ? (
        <Callout variant="info" title="Model minus the majority-class guess (negative favours the model)">
          <ul className="space-y-0.5">
            <li>
              Log loss <span className="num">{signed(vs.log_loss?.value)}</span> [<span className="num">{ci(vs.log_loss?.ci95)}</span>]: {verdictFor(vs.log_loss)}.
            </li>
            <li>
              Brier <span className="num">{signed(vs.brier?.value)}</span> [<span className="num">{ci(vs.brier?.ci95)}</span>]: {verdictFor(vs.brier)}.
            </li>
          </ul>
        </Callout>
      ) : null}
      {g.calibration?.text ? (
        <p className="max-w-[72ch] text-[13px] leading-relaxed text-fg" data-testid="calibration-text">
          <strong>Calibration{g.calibration.claim_calibrated ? "" : " (not claimed calibrated)"}.</strong> {g.calibration.text}{" "}
          <span className="text-muted">Rule: {g.calibration.rule}.</span>
        </p>
      ) : null}
      <p className="text-xs text-muted">
        {g.cv.scheme}. Out-of-fold predictions pooled: <span className="num">{fmtCount(g.cv.n_pooled_predictions)}</span>.
      </p>
    </div>
  );
}

function Blindspot({ g }: { g: ExtGroupValidation }) {
  const b = g.blindspot_test;
  const short = blindspotShortfall(g);
  const pairs = b.group_level.pairs.map((p) => ({ x: p.pre_reveal_uncertainty, y: p.error, label: p.experiment_id }));
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="neutral">{VERDICT_WORD[b.verdict] ?? b.verdict}</Badge>
        {short ? <span className="text-xs text-muted">Why: {short}.</span> : null}
      </div>
      <p className="max-w-[72ch] text-xs leading-relaxed text-muted">
        Does the model flag in advance where it will be wrong? <strong className="font-medium text-fg">Supported</strong> means uncertainty before the reveal rises with log loss afterwards (Spearman, one-sided p &lt; 0.05) for both points and
        withheld experiments, and still does after controlling for outcome-variability (aleatoric) uncertainty. <strong className="font-medium text-fg">Not supported</strong> means the correlation is 0 or negative at both levels. Anything else is inconclusive.
      </p>
      <div className="grid grid-cols-1 gap-4">
        {pairs.length ? (
          <ScatterPlot
            points={pairs}
            xLabel="Knowledge uncertainty before reveal (nats)"
            yLabel="Error after reveal (log loss)"
            ariaLabel={`Scatter of epistemic uncertainty before reveal against error after reveal for ${pairs.length} withheld experiments`}
          />
        ) : (
          <P className="text-muted">No experiment-level pairs are available for this test set.</P>
        )}
        <div className="space-y-3">
          <Table containerClassName="rounded-[var(--radius-lg)] border-border/70">
            <caption className="sr-only">Blind-spot test statistics</caption>
            <TableHeader>
              <TableRow>
                <TableHead>Level</TableHead>
                <TableHead numeric>n</TableHead>
                <TableHead numeric>Spearman rho</TableHead>
                <TableHead numeric>p (one-sided)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>Points (flow steps)</TableCell>
                <TableCell numeric>{fmtCount(b.point_level.n)}</TableCell>
                <TableCell numeric>{f(b.point_level.spearman_rho, 2)}</TableCell>
                <TableCell numeric>{pText(b.point_level.p_value)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Withheld experiments</TableCell>
                <TableCell numeric>{fmtCount(b.group_level.n_groups)}</TableCell>
                <TableCell numeric>{f(b.group_level.spearman_rho, 2)}</TableCell>
                <TableCell numeric>{pText(b.group_level.p_value)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
          <p className="text-xs text-muted">
            AUROC for flagging misclassified points: <span className="num">{f(b.point_level.auroc_error_detection, 2)}</span>
            {typeof b.point_level.n_misclassified === "number" ? <> (<span className="num">{b.point_level.n_misclassified}</span> misclassified)</> : null}. p-values are permutation tests
            {b.group_level.p_value_note ? ` (${b.group_level.p_value_note})` : ""}; the smallest possible is about 0.0005.
          </p>
          {b.diagnostics ? (
            <p className="text-xs text-muted">
              Diagnostics: rho of aleatoric uncertainty vs loss <span className="num">{f(b.diagnostics.rho_aleatoric_point, 2)}</span>; epistemic vs loss given aleatoric{" "}
              <span className="num">{f(b.diagnostics.partial_rho_epistemic_given_aleatoric, 2)}</span>.
            </p>
          ) : null}
        </div>
      </div>
      <Callout variant="info" title="What this means (generated from the numbers)">
        {b.interpretation}
      </Callout>
      {b.rule ? <p className="max-w-[72ch] text-xs leading-relaxed text-muted">Verdict rule: {b.rule}</p> : null}
    </div>
  );
}

function Retrospective({ scenarios }: { scenarios: ExtScenario[] }) {
  const [idx, setIdx] = useState(0);
  const sc = scenarios[Math.min(idx, scenarios.length - 1)];
  if (!sc) return null;
  const series: LineSeries[] = (["evr", "uncertainty_sampling", "nearest_gap", "random"] as const)
    .filter((k) => sc.curves[k]?.length)
    .map((k) => ({ key: k, label: STRATEGY_STYLE[k]?.label ?? k, stroke: STRATEGY_STYLE[k]?.stroke ?? "var(--muted)", dash: STRATEGY_STYLE[k]?.dash, points: (sc.curves[k] ?? []).map((p) => ({ x: p.n_acquired, mean: p.mean, ci: p.ci95 })) }));
  const maj = sc.majority_class_baseline;
  const paired = Object.entries(sc.paired_differences ?? {});
  return (
    <div className="space-y-3">
      {scenarios.length > 1 ? (
        <div className="max-w-sm">
          <label htmlFor="retro-scenario" className="mb-1 block text-xs text-muted">
            Practice scenario
          </label>
          <Select id="retro-scenario" value={String(idx)} onValueChange={(v) => setIdx(Number(v))} options={scenarios.map((s, i) => ({ value: String(i), label: scenarioLabel(s.name) }))} />
        </div>
      ) : null}
      <P className="text-muted">
        <span className="font-medium text-fg">{scenarioLabel(sc.name)}</span>: {sc.target_definition}. <span className="num">{sc.n_seeds}</span> random starts, <span className="num">{sc.n_rounds}</span> rounds
        {typeof sc.n_target_experiments === "number" ? <>, <span className="num">{sc.n_target_experiments}</span> hidden target experiments ({fmtCount(sc.n_target_observations)} test results
        {sc.target_class_balance ? <>, <span className="num">{sc.target_class_balance.sustained}</span> kept burning / <span className="num">{sc.target_class_balance.not_sustained}</span> went out</> : null})</> : null}
        {typeof sc.n_pool_experiments === "number" ? <>; <span className="num">{sc.n_pool_experiments}</span> experiments to pick from</> : null}.
      </P>
      <LineBands
        series={series}
        xLabel="Experiments acquired"
        yLabel={sc.metric}
        reference={typeof maj?.target_log_loss === "number" ? { value: maj.target_log_loss, label: "majority-class constant" } : null}
        ariaLabel={`${sc.metric} against experiments acquired for four selection strategies, scenario ${scenarioLabel(sc.name)}, with 95 percent intervals across seeds`}
      />
      <div className="grid grid-cols-1 gap-4">
        <Table containerClassName="rounded-[var(--radius-lg)] border-border/70">
          <caption className="sr-only">Area under the target log-loss curve by strategy</caption>
          <TableHeader>
            <TableRow>
              <TableHead>Strategy</TableHead>
              <TableHead numeric>Area under curve (lower is better)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Object.entries(sc.area_under_curve).map(([k, v]) => (
              <TableRow key={k}>
                <TableCell>{STRATEGY_STYLE[k]?.label ?? k}</TableCell>
                <TableCell numeric>{f(v)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {paired.length ? (
          <Table containerClassName="rounded-[var(--radius-lg)] border-border/70">
            <caption className="sr-only">Paired differences in area under the curve</caption>
            <TableHeader>
              <TableRow>
                <TableHead>Blind Spots minus</TableHead>
                <TableHead numeric>Difference [95 % CI]</TableHead>
                <TableHead numeric>Seeds where Blind Spots is better</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paired.map(([k, d]) => (
                <TableRow key={k}>
                  <TableCell>{STRATEGY_STYLE[k.replace("evr_minus_", "")]?.label ?? k}</TableCell>
                  <TableCell numeric className="h-auto py-1 leading-tight">
                    {signed(d.mean_auc_difference)}
                    <div className="text-[11px] text-muted">[{ci(d.ci95)}]</div>
                  </TableCell>
                  <TableCell numeric>{typeof d.fraction_seeds_evr_better === "number" ? fmtFractionPercent(d.fraction_seeds_evr_better, 0) : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : null}
      </div>
      <Callout variant="info" title="What this means (generated from the numbers)">
        {sc.interpretation}
      </Callout>
    </div>
  );
}

function Tile({ label, value, meaning }: { label: string; value: string | null; meaning: string }) {
  return (
    <div className="card min-w-0 rounded-[var(--radius-xl)] bg-surface p-4 sm:p-5">
      <div className="text-xs text-muted">{label}</div>
      <div className={cn("dotnum mt-2 break-words leading-none text-fg", (value?.length ?? 0) > 8 ? "text-[26px]" : "text-[28px] sm:text-[32px]")}>
        {value === null || value === "" ? (
          <>
            <span aria-hidden>&ndash;</span>
            <span className="sr-only">not available</span>
          </>
        ) : (
          value
        )}
      </div>
      <p className="mt-2 text-xs leading-snug text-muted">{meaning}</p>
    </div>
  );
}

/** One collapsed detail: a plain-words title, the technical content behind it. */
function Detail({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Disclosure tone="strong" className="card rounded-[var(--radius-xl)] bg-surface px-4 sm:px-5" summaryClassName="flex w-full min-h-12 text-[14px] hover:text-accent" contentClassName="mt-1 space-y-3 pb-4 pl-0 text-fg sm:pl-5" summary={title}>
      {children}
    </Disclosure>
  );
}

function GroupValidationView({ g, summary, retro }: { g: ExtGroupValidation; summary: GroupSummary | undefined; retro: ExtScenario[] }) {
  const sus = summary?.label_counts.sustained ?? null;
  const not = summary?.label_counts.not_sustained ?? null;
  const total = sus !== null && not !== null ? sus + not : null;
  const majority = total ? Math.max(sus as number, not as number) / total : null;
  const flowOff = g.sensitivity.find((s) => s.variant.includes("flow_off_transient"));
  const flowOffLeft = flowOff && typeof flowOff.n_not_sustained === "number" && flowOff.n_not_sustained < 3 ? flowOff : null;
  const smallSample = g.n_experiments < 30 || (not !== null && not < 20);
  const bins = g.reliability.bins;
  const err = g.error_distribution;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="ISS tests" value={fmtCount(g.n_experiments)} meaning="Real experiments, each hidden in turn." />
        <Tile label="Test results" value={total !== null ? fmtCount(total) : fmtCount(g.n_observations)} meaning="Single flame outcomes in this set." />
        <Tile label="Kept burning / went out" value={sus !== null && not !== null ? `${sus} / ${not}` : null} meaning="How many of each outcome." />
        <Tile label="Score to beat" value={majority !== null ? fmtFractionPercent(majority, 0) : null} meaning="Right this often by always guessing the common outcome." />
      </div>

      {smallSample ? (
        <Callout variant="info" title="Small sample">
          {fmtCount(g.n_experiments)} tests{not !== null ? ` and ${fmtCount(not)} went-out results` : ""}. Numbers can swing a lot, so trust the ranges more than single values.
        </Callout>
      ) : null}
      {flowOffLeft ? (
        <Callout variant="info" title="Most flame-outs came from turning the flow off">
          Without those flow-turned-off steps, {flowOffLeft.n_not_sustained} went-out {flowOffLeft.n_not_sustained === 1 ? "result remains" : "results remain"}. Any gain over guessing mostly reflects &quot;no flow, no flame&quot;, not a learned flammability limit.
        </Callout>
      ) : null}

      <div className="space-y-3">
        <Detail title="How it compares with simple guesses">
          <ModelComparison g={g} />
        </Detail>

        <Detail title="How reliable the probabilities are">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Fig
              title="Predicted chance vs what happened"
              note={`Each dot is a bin of predictions; bigger dots hold more. Counts pool ${g.cv.repeats ?? "all"} repeats. Sparse bins are unreliable.`}
            >
              <ReliabilityDiagram
                bins={bins.map((b) => ({ lo: b.lo, hi: b.hi, count: b.count, meanPredicted: b.mean_predicted, observedFrequency: b.observed_frequency }))}
                ariaLabel="Reliability diagram: observed frequency of sustained flame against mean predicted probability by bin, with bin counts"
              />
            </Fig>
            <Fig title="How far off the predictions were" note="Gap between the predicted chance and what happened (0 or 1).">
              {err.counts.length ? (
                <Histogram edges={err.bins} counts={err.counts} xLabel="|outcome - predicted probability|" ariaLabel="Histogram of absolute prediction errors" />
              ) : (
                <P className="text-muted">No error data is available.</P>
              )}
            </Fig>
          </div>
        </Detail>

        <Detail title="Leaving out a whole campaign">
          {g.logo.applicable && g.logo.folds.length ? (
            <>
              <Table containerClassName="rounded-[var(--radius-lg)] border-border/70">
                <caption className="sr-only">Leave-one-campaign-out results</caption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Held-out campaign</TableHead>
                    <TableHead numeric>n</TableHead>
                    <TableHead numeric>Not sustained</TableHead>
                    <TableHead numeric>Brier</TableHead>
                    <TableHead numeric>Log loss</TableHead>
                    <TableHead numeric>AUC</TableHead>
                    <TableHead numeric>Majority log loss</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {g.logo.folds.map((r) => (
                    <TableRow key={r.held_out}>
                      <TableCell>{r.held_out}</TableCell>
                      <TableCell numeric>{r.n}</TableCell>
                      <TableCell numeric>{typeof r.n_not_sustained === "number" ? r.n_not_sustained : "—"}</TableCell>
                      <TableCell numeric>{f(r.brier)}</TableCell>
                      <TableCell numeric>{f(r.log_loss)}</TableCell>
                      <TableCell numeric>{f(r.auc)}</TableCell>
                      <TableCell numeric>{f(r.majority_log_loss)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p className="text-xs text-muted">Small folds give unstable values; none are hidden. Oxygen is nearly tied to campaign, so this is a hard test.</p>
            </>
          ) : (
            <P className="text-muted">Not applicable{g.logo.reason ? `: ${g.logo.reason}` : ""}.</P>
          )}
        </Detail>

        <Detail title="Results by subgroup">
          <Table containerClassName="rounded-[var(--radius-lg)] border-border/70">
            <caption className="sr-only">Out-of-fold performance by subgroup</caption>
            <TableHeader>
              <TableRow>
                <TableHead>Subgroup</TableHead>
                <TableHead numeric>n</TableHead>
                <TableHead numeric>Not sustained</TableHead>
                <TableHead numeric>Brier</TableHead>
                <TableHead numeric>Log loss</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {g.subgroups.map((s) => (
                <TableRow key={s.name}>
                  <TableCell>{subgroupLabel(s.name)}</TableCell>
                  <TableCell numeric>{s.n}</TableCell>
                  <TableCell numeric>{typeof s.n_not_sustained === "number" ? s.n_not_sustained : "—"}</TableCell>
                  <TableCell numeric>{f(s.brier)}</TableCell>
                  <TableCell numeric>{f(s.log_loss)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="text-xs text-muted">Few went-out results means little can be said. Curation confidence is tied to the outcome in some sets, so it does not measure curation quality.</p>
        </Detail>

        <Detail title="If we change an assumption">
          <Table containerClassName="rounded-[var(--radius-lg)] border-border/70">
            <caption className="sr-only">Sensitivity of cross-validated performance to analysis choices</caption>
            <TableHeader>
              <TableRow>
                <TableHead>Variant</TableHead>
                <TableHead numeric>Rows</TableHead>
                <TableHead numeric>Not sustained</TableHead>
                <TableHead numeric>Brier</TableHead>
                <TableHead numeric>Log loss</TableHead>
                <TableHead numeric>AUC</TableHead>
                <TableHead numeric>Delta log loss</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {g.sensitivity.map((s) => (
                <TableRow key={s.variant}>
                  <TableCell className="h-auto py-1.5">{variantLabel(s.variant)}</TableCell>
                  <TableCell numeric>{s.n_training}</TableCell>
                  <TableCell numeric>{typeof s.n_not_sustained === "number" ? s.n_not_sustained : "—"}</TableCell>
                  <TableCell numeric>{f(s.brier)}</TableCell>
                  <TableCell numeric>{f(s.log_loss)}</TableCell>
                  <TableCell numeric>
                    {typeof s.n_not_sustained === "number" && s.n_not_sustained < MIN_NEG_FOR_AUC ? <span className="text-xs text-muted" title={`AUC ${f(s.auc)} on ${s.n_not_sustained} not-sustained rows`}>not interpretable</span> : f(s.auc)}
                  </TableCell>
                  <TableCell numeric>{signed(s.delta_vs_primary)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="text-xs text-muted">
            AUC is skipped when fewer than {MIN_NEG_FOR_AUC} went-out results remain. Each variant uses its own rows, so deltas are not like for like. Pressure length-scale variants change nothing here because pressure does not vary in the data.
          </p>
        </Detail>

        <Detail title="Does uncertainty warn us before mistakes?">
          <Blindspot g={g} />
        </Detail>

        <Detail title="Practice runs of choosing the next tests">
          {retro.length ? (
            <>
              <P className="text-muted">We hid real experiments as the target. Each strategy picks experiments to learn from, then we score the model on the target. Lower curves are better.</P>
              <Retrospective key={g.group_id} scenarios={retro} />
            </>
          ) : (
            <P className="text-muted">No practice runs are available for this set.</P>
          )}
        </Detail>
      </div>
    </div>
  );
}

const FLOW_OFF = /flow_off/i;
const BELOW_CAL = /below_calibration/i;

/** Headline numbers, each with a one-line plain meaning, then the caveats that limit them (collapsed). All values are computed from the validation artifact. */
function ReadThisFirst({ v, labels }: { v: ExtValidation; labels: Map<string, GroupSummary> }) {
  const name = (id: string) => labels.get(id)?.label ?? id;
  const gs = v.groups;
  const beats = gs.filter((g) => (g.cv.gp_vs_majority?.log_loss?.ci95?.[1] ?? 1) < 0);
  const supported = gs.filter((g) => g.blindspot_test.verdict === "supported");
  const inconclusive = gs.filter((g) => g.blindspot_test.verdict === "inconclusive");
  const gpAuc = (g: ExtGroupValidation) => g.cv.models.find((m) => m.name === "gp")?.auc.value ?? null;
  const flowOff = gs.flatMap((g): { g: ExtGroupValidation; a0: number; a1: number | null; noNeg: boolean }[] => {
    const row = g.sensitivity.find((x) => FLOW_OFF.test(x.variant));
    const a0 = gpAuc(g);
    if (!row || a0 === null) return [];
    const noNeg = typeof row.n_not_sustained === "number" && row.n_not_sustained < MIN_NEG_FOR_AUC;
    // With no other not-sustained rows the ablated AUC is undefined; that is itself the dependence.
    if (noNeg) return [{ g, a0, a1: null as number | null, noNeg }];
    if (row.auc === null || a0 - row.auc < 0.1) return [];
    return [{ g, a0, a1: row.auc as number | null, noNeg }];
  });
  const below = gs.flatMap((g) => {
    const row = g.sensitivity.find((x) => BELOW_CAL.test(x.variant));
    const n = labels.get(g.group_id)?.n_training;
    return row && typeof n === "number" && n > 0 && row.n_training < 0.75 * n ? [{ g, kept: row.n_training, n }] : [];
  });
  const ranges = gs.flatMap((g) => labels.get(g.group_id)?.pressure_kpa_range ?? []);
  const summary = (v.acquisition_retrospective as { summary?: RetroSummary }).summary;
  const cmp = (k: keyof RetroSummary, label: string) => {
    const c = summary?.[k] as { better: number; indistinguishable: number; worse: number } | undefined;
    return c ? `${label}: better in ${c.better}, level in ${c.indistinguishable}, worse in ${c.worse}` : null;
  };
  const parts = [cmp("evr_vs_random", "vs random"), cmp("evr_vs_uncertainty_sampling", "vs uncertainty sampling"), cmp("evr_vs_nearest_gap", "vs nearest gap")].filter((x): x is string => x !== null);
  return (
    <div className="space-y-4" data-testid="read-this-first">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Beats guessing" value={`${beats.length} of ${gs.length}`} meaning="Test sets where the model clearly beats always guessing the common outcome." />
        <Tile label="Warns before mistakes" value={`${supported.length} of ${gs.length}`} meaning="Test sets where higher uncertainty came before bigger errors." />
        {summary ? <Tile label="Practice runs" value={String(summary.n_scenarios)} meaning="Choosing next tests: modest evidence, no sure edge over a simple rule." /> : null}
        {ranges.length ? <Tile label="Pressure tested (kPa)" value={`${f(Math.min(...ranges), 1)} to ${f(Math.max(...ranges), 1)}`} meaning="All ISS tests in our data ran near 1 atm. Low pressure is untested." /> : null}
      </div>
      <Disclosure tone="strong" summary="What limits these results" data-testid="read-this-first-details" className="card rounded-[var(--radius-xl)] bg-surface px-4 sm:px-5" summaryClassName="flex w-full min-h-12 text-[14px] hover:text-accent" contentClassName="mt-1 pb-4 pl-0 text-fg sm:pl-5">
        <ul className="list-disc space-y-1.5 pl-4 text-xs text-muted">
          <li>
            <strong className="font-medium text-fg">Against the majority-class baseline</strong>, the model is clearly better (log-loss interval excludes 0) in {beats.length} of {gs.length} test sets
            {beats.length ? ` (${beats.map((g) => name(g.group_id)).join("; ")})` : ""}. In the other {gs.length - beats.length} it is about level.
          </li>
          {flowOff.length ? (
            <li>
              <strong className="font-medium text-fg">Sphere results lean on flow-turned-off steps.</strong> Dropping them lowers the cross-validated AUC:{" "}
              {flowOff.map((x) => {
                const left = x.g.sensitivity.find((r) => FLOW_OFF.test(r.variant))?.n_not_sustained ?? 0;
                return x.noNeg ? `${name(x.g.group_id)} ${f(x.a0, 2)}, but only ${left} went-out ${left === 1 ? "result remains" : "results remain"}, so it cannot be re-checked` : `${name(x.g.group_id)} ${f(x.a0, 2)} to ${f(x.a1, 2)}`;
              }).join("; ")}. Those labels come from turning the flow off, not a physical quench boundary.
            </li>
          ) : null}
          {below.length ? (
            <li>
              <strong className="font-medium text-fg">Many near-quench steps rely on interpolated flows below the calibrated range.</strong> Without them:{" "}
              {below.map((x) => `${name(x.g.group_id)} keeps ${x.kept} of ${x.n} test results`).join("; ")}.
            </li>
          ) : null}
          <li>
            <strong className="font-medium text-fg">Blind-spot test:</strong> supported in {supported.length} test set{supported.length === 1 ? "" : "s"}
            {supported.length ? ` (${supported.map((g) => name(g.group_id)).join("; ")})` : ""}, inconclusive in {inconclusive.length}.
          </li>
          {ranges.length ? (
            <li>
              <strong className="font-medium text-fg">The pressure length scale is fixed, not learned.</strong> At low pressure, predictions fall back to the training base rate. That is not a pressure effect, and we do not show it as an estimate when evidence is thin.
            </li>
          ) : null}
          {summary ? (
            <li>
              <strong className="font-medium text-fg">Choosing next tests</strong> ({summary.n_scenarios} scenarios; {parts.join("; ")}): modest small-sample evidence. No reliable edge over the nearest-gap rule, and the scenarios overlap.
            </li>
          ) : null}
          <li>Every test set uses a constant model mean, fixed in advance; none is selected.</li>
        </ul>
      </Disclosure>
    </div>
  );
}

type RetroSummary = {
  n_scenarios: number;
  evr_vs_random?: { better: number; indistinguishable: number; worse: number };
  evr_vs_uncertainty_sampling?: { better: number; indistinguishable: number; worse: number };
  evr_vs_nearest_gap?: { better: number; indistinguishable: number; worse: number };
};

export function ValidationSection({
  validation,
  groups,
  group,
  onGroupChange,
}: {
  validation: ApiQuery<ExtValidation>;
  groups: GroupSummary[] | undefined;
  group: string | null;
  onGroupChange: (g: string) => void;
}) {
  const labels = useMemo(() => new Map((groups ?? []).map((g) => [g.group_id, g])), [groups]);
  return (
    <Section id="validation" number={4} title="Validation" intro="We hid whole ISS experiments, then checked the model's guesses against them. This is not new experiments.">
      <QueryBoundary query={validation} rows={5}>
        {(v) => {
          if (v.groups.length === 0) return <Callout variant="warning" title="No validation results">There are no modelled test sets.</Callout>;
          const gid = group && v.groups.some((x) => x.group_id === group) ? group : (v.groups[0]?.group_id ?? "");
          const g = v.groups.find((x) => x.group_id === gid) ?? (v.groups[0] as ExtGroupValidation);
          const retro = v.acquisition_retrospective.scenarios.filter((s) => s.group_id === gid);
          const notModelled = Object.entries(v.not_modelled ?? {});
          return (
            <>
              <ReadThisFirst v={v} labels={labels} />
              <div id="validation-detail" className="scroll-mt-[calc(var(--header-h)+16px)]">
                <div className="w-full max-w-sm">
                  <label htmlFor="val-group" className="mb-1 block text-xs text-muted">
                    See details for
                  </label>
                  <Select
                    id="val-group"
                    value={gid}
                    onValueChange={onGroupChange}
                    options={v.groups.map((x) => ({ value: x.group_id, label: `${labels.get(x.group_id)?.label ?? x.group_id} (${x.n_experiments} tests)` }))}
                  />
                </div>
              </div>
              <GroupValidationView key={gid} g={g} summary={labels.get(gid)} retro={retro} />
              {notModelled.length ? (
                <Detail title="Test sets we did not model">
                  <P className="text-muted">Too few tests or outcomes to check the model fairly, so we show coverage only.</P>
                  <Table containerClassName="max-h-[320px] rounded-[var(--radius-lg)] border-border/70">
                    <caption className="sr-only">Groups without a model and the reason</caption>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Test set</TableHead>
                        <TableHead>Reason</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {notModelled.map(([k, r]) => (
                        <TableRow key={k}>
                          <TableCell className="h-auto py-1.5">{labels.get(k)?.label ?? k}</TableCell>
                          <TableCell className="h-auto py-1.5 text-muted">{r}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Detail>
              ) : null}
            </>
          );
        }}
      </QueryBoundary>
    </Section>
  );
}
