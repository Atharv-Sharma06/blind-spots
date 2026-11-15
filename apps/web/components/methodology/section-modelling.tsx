"use client";

import { Callout } from "@/components/ui/callout";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ApiQuery } from "@/hooks/api";
import type { MethodologyResponse, ModelMetadata } from "@/lib/types";
import { fmtCount } from "@/lib/format";
import { Bullets, Formula, Mono, P, QueryBoundary, Section, Sub, inline } from "./primitives";

const num = (v: unknown, d = 3): string => (typeof v === "number" && Number.isFinite(v) ? String(Number(v.toPrecision(d))) : "—");

function Card({ meta }: { meta: ModelMetadata }) {
  const hp = meta.hyperparameters ?? {};
  const fixed = Array.isArray(meta.fixed_hyperparameters) ? (meta.fixed_hyperparameters as unknown[]).map(String) : [];
  const priors = Object.entries(meta.priors ?? {}) as [string, { log_mean?: number; log_sd?: number }][];
  const hpRows = Object.entries(hp);
  return (
    <div className="space-y-3">
      <P>
        Model card for <Mono>{meta.group_id}</Mono> (<Mono>{meta.model_version}</Mono>): trained on <span className="num">{fmtCount(meta.training.n_observations)}</span> observations from{" "}
        <span className="num">{fmtCount(meta.training.n_experiments)}</span> experiments (<span className="num">{fmtCount(meta.training.label_counts.sustained)}</span> sustained,{" "}
        <span className="num">{fmtCount(meta.training.label_counts.not_sustained)}</span> not sustained), seed <span className="num">{meta.seed}</span>. {meta.algorithm}.
      </P>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Table>
          <caption className="sr-only">Fitted hyperparameters</caption>
          <TableHeader>
            <TableRow>
              <TableHead>Hyperparameter</TableHead>
              <TableHead numeric>Value</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {hpRows.map(([k, v]) => (
              <TableRow key={k}>
                <TableCell className="num">{k}</TableCell>
                <TableCell numeric>{num(v)}</TableCell>
                <TableCell className="text-xs text-muted">{fixed.includes(k) ? "fixed, not learned" : "fitted (MAP-II)"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Table>
          <caption className="sr-only">Priors (log-normal: Gaussian on the log of the parameter)</caption>
          <TableHeader>
            <TableRow>
              <TableHead>Prior on</TableHead>
              <TableHead numeric>Mean of log</TableHead>
              <TableHead numeric>SD of log</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {priors.map(([k, v]) => (
              <TableRow key={k}>
                <TableCell className="num">{k}</TableCell>
                <TableCell numeric>{num(v?.log_mean)}</TableCell>
                <TableCell numeric>{num(v?.log_sd)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export function ModellingSection({
  methodology,
  metadata,
  groupLabel,
}: {
  methodology: ApiQuery<MethodologyResponse>;
  metadata: ApiQuery<ModelMetadata>;
  groupLabel: string | null;
}) {
  return (
    <Section
      id="modelling"
      number={2}
      title="Modelling"
      intro="A small, deliberately simple probabilistic model, fitted separately for each analysis group and judged against simple baselines."
    >
      <Sub title="Prediction task">
        <P>
          Given oxygen concentration, airflow and pressure, the model estimates the probability that a flame is <strong>sustained at a recorded airflow step</strong>. It is not a flame-spread
          or burn-rate model, and the airflow is that of the step, not a time-averaged cabin value. Predictions are made within one analysis group at a time.
        </P>
      </Sub>

      <Sub title="Inputs">
        <Formula label="Model inputs">{`x1 = oxygen concentration, % by volume
x2 = ln(1 + airflow in cm/s)
x3 = ln(total pressure / 101.325 kPa)`}</Formula>
        <P>
          Coverage and support use the same coordinates with fixed reference scales ({inline(methodology, (m) => <CoverageScales v={m.config.coverage_scales} />)}); two observations are &quot;comparable&quot; when their scaled distance is at most 1.
        </P>
      </Sub>

      <Sub title="Gaussian-process classifier with Laplace approximation">
        <P>
          Class probabilities come from a latent function <Mono>f</Mono> with a Gaussian-process prior, a logistic link, and a Laplace (Gaussian) approximation to the posterior of{" "}
          <Mono>f</Mono> (Rasmussen and Williams, 2006). The kernel is an automatic-relevance-determination squared exponential: one length scale per input, plus a signal variance. The
          prior mean is constant and fixed a priori for every group; no mean-function selection is performed.
        </P>
        <Formula label="Predictive probability">{`P(sustained | x) = E[ sigmoid(f(x)) ],   f(x) ~ N(mean(x), var(x))
(computed by Gauss-Hermite quadrature; var(x) is the Laplace posterior variance)`}</Formula>
        <P>
          <strong>Priors.</strong> Hyperparameters are fitted by maximum a posteriori (MAP-II) with log-normal priors (Gaussian on the logarithm of each positive parameter). Prior means and spreads are shown in the
          model card below; they are weakly informative choices, not estimates from NASA data.
        </P>
        <P>
          <strong>Fixed pressure length scale.</strong> Every integrated observation is at about 1 atm, so the data contain no information about how flammability changes with pressure. The pressure length scale is
          therefore <em>fixed</em> (default{" "}
          {inline(methodology, (m) => <span className="num">{num(m.config.pressure_length_scale_default)}</span>)} in ln-pressure units) and cannot be learned. A
          sensitivity check at{" "}
          {inline(methodology, (m) => <span className="num">{((m.config as { pressure_length_scale_sensitivity?: number[] }).pressure_length_scale_sensitivity ?? []).map((x) => num(x)).join(" / ") || "—"}</span>)}{" "}
          is reported. <strong>Any prediction away from about 1 atm is assumption-driven.</strong>
        </P>
        <QueryBoundary query={metadata} rows={4}>
          {(meta) => <Card meta={meta} />}
        </QueryBoundary>
        {groupLabel ? <P className="text-muted">Card shown for the group selected in section 4: {groupLabel}.</P> : null}
      </Sub>

      <Sub title="Baselines">
        <Bullets>
          <li>
            <strong>Majority class:</strong> a constant, the Laplace-smoothed share of sustained rows in the training data. With roughly nine in ten rows sustained in some groups, this is hard to beat; every result is
            compared with it.
          </li>
          <li>
            <strong>Logistic on oxygen</strong> and <strong>logistic on oxygen, flow and flow squared</strong> (L2-regularised).
          </li>
          <li>
            <strong>Bootstrap logistic ensemble</strong> (200 members): a second uncertainty estimate that does not use a Gaussian process.
          </li>
        </Bullets>
      </Sub>

      <Sub title="Calibration">
        <P>
          Calibration is assessed, not forced: no post-hoc recalibration is applied. Section 4 shows reliability diagrams from out-of-fold predictions (10 equal-width bins, with bin counts) and the expected calibration error (ECE), which
          is biased upward in small samples.
        </P>
      </Sub>

      <Sub title="Uncertainty: knowledge versus outcome variability">
        <Formula label="Uncertainty decomposition (nats)">{`total      = H( E[p] )              entropy of the mean predicted probability
aleatoric  = E[ H(p) ]              outcome variability the model expects at this setting
epistemic  = total - aleatoric      what more data about f could reduce (mutual information)`}</Formula>
        <P>
          <strong>Epistemic</strong> (lack of knowledge) shrinks as comparable experiments are added. <strong>Aleatoric</strong> (outcome variability) does not: if flames at nearly identical settings sometimes persist and sometimes
          do not, a near-50 % probability is the honest answer. The latent standard deviation is also reported as a ratio to the prior standard deviation (0 means fully constrained by data, 1 means no more certain than the prior).
        </P>
      </Sub>

      <Sub title="Support verdict rules">
        <P>Each prediction carries a verdict, computed per point from the training coordinates of that group. Thresholds below are implementation constants in the analysis code, not tuned parameters.</P>
        <Table>
          <caption className="sr-only">Support verdict rules</caption>
          <TableHeader>
            <TableRow>
              <TableHead>Verdict</TableHead>
              <TableHead>Rule</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="h-auto whitespace-nowrap py-2 font-medium">Supported</TableCell>
              <TableCell className="h-auto py-2">Inside the convex hull of observed conditions, or at least 3 comparable observations, and latent standard-deviation ratio below 0.6.</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="h-auto whitespace-nowrap py-2 font-medium">Insufficient evidence</TableCell>
              <TableCell className="h-auto py-2">No comparable observation and latent standard-deviation ratio above 0.85. The interface then says: &quot;Insufficient experimental evidence for a reliable estimate.&quot;</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="h-auto whitespace-nowrap py-2 font-medium">Extrapolation</TableCell>
              <TableCell className="h-auto py-2">Everything else.</TableCell>
            </TableRow>
          </TableBody>
        </Table>
        <P>
          Reason codes explain a verdict: <Mono>sparse_observations</Mono> (fewer than 3 comparable), <Mono>outside_hull</Mono>, <Mono>unobserved_pressure</Mono> (nearest observed pressure differs by more than the reference scale),{" "}
          <Mono>outcome_variability</Mono> (aleatoric share above 0.6 with a small latent ratio), <Mono>model_instability</Mono> and <Mono>other_family_evidence_only</Mono>. A target region is summarised as supported when at least 75 % of its
          points are, insufficient evidence when at least 50 % are, otherwise extrapolation.
        </P>
      </Sub>

      <Callout variant="warning" title="Limitations of the model">
        Small samples (a few dozen experiments per group) and strong class imbalance make intervals wide and metrics unstable. Several groups cannot be told apart from the majority-class baseline (section 4). Pressure is
        assumption-driven, and the model has no physics inside it: it interpolates the integrated records and flags where they stop.
      </Callout>
    </Section>
  );
}

function CoverageScales({ v }: { v: unknown }) {
  if (typeof v !== "object" || v === null) return <>not reported</>;
  const r = v as Record<string, unknown>;
  return (
    <span className="num">
      O2 {num(r.o2)} %, ln-flow {num(r.flow)}, ln-pressure {num(r.p)}
    </span>
  );
}
