"use client";

import { Callout } from "@/components/ui/callout";
import { Disclosure } from "@/components/ui/disclosure";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ApiQuery } from "@/hooks/api";
import type { MethodologyResponse, ModelMetadata } from "@/lib/types";
import { fmtCount } from "@/lib/format";
import { Bullets, Formula, Mono, P, QueryBoundary, Section, Sub, inline } from "./primitives";

const num = (v: unknown, d = 3): string => (typeof v === "number" && Number.isFinite(v) ? String(Number(v.toPrecision(d))) : "—");

function Card({ meta, label }: { meta: ModelMetadata; label: string | null }) {
  const hp = meta.hyperparameters ?? {};
  const fixed = Array.isArray(meta.fixed_hyperparameters) ? (meta.fixed_hyperparameters as unknown[]).map(String) : [];
  const priors = Object.entries(meta.priors ?? {}) as [string, { log_mean?: number; log_sd?: number }][];
  const hpRows = Object.entries(hp);
  return (
    <div className="space-y-3">
      <P>
        Model card for {label ?? meta.group_id}: trained on <span className="num">{fmtCount(meta.training.n_observations)}</span> test results from{" "}
        <span className="num">{fmtCount(meta.training.n_experiments)}</span> experiments (<span className="num">{fmtCount(meta.training.label_counts.sustained)}</span> flame kept burning,{" "}
        <span className="num">{fmtCount(meta.training.label_counts.not_sustained)}</span> went out). Version <Mono>{meta.model_version}</Mono>, seed <span className="num">{meta.seed}</span>. {meta.algorithm}.
      </P>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Table>
          <caption className="sr-only">Fitted settings</caption>
          <TableHeader>
            <TableRow>
              <TableHead>Setting</TableHead>
              <TableHead numeric>Value</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {hpRows.map(([k, v]) => (
              <TableRow key={k}>
                <TableCell className="num">{k}</TableCell>
                <TableCell numeric>{num(v)}</TableCell>
                <TableCell className="text-xs text-muted">{fixed.includes(k) ? "fixed, not learned" : "fitted to data"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Table>
          <caption className="sr-only">Starting guesses (priors), on a log scale</caption>
          <TableHeader>
            <TableRow>
              <TableHead>Starting guess for</TableHead>
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
    <Section id="modelling" number={2} title="Modelling" intro="How ISS test results become a chance that a flame keeps burning.">
      <Bullets>
        <li>The model learns from ISS flame tests, one material and flame type at a time.</li>
        <li>
          Give it oxygen, airflow and pressure. It estimates the chance the <strong>flame keeps burning</strong>.
        </li>
        <li>It also says how unsure it is, and hides its estimate where no ISS test is nearby.</li>
        <li>
          Every ISS test ran at about normal pressure (1 atm), so any answer at another pressure is an <strong>assumption</strong>.
        </li>
        <li>It does not predict how fast a flame spreads.</li>
      </Bullets>

      <Callout variant="info" title="Limits">
        Few experiments per material, and mostly &quot;kept burning&quot; results, make the numbers shaky. Some materials cannot be told apart from the majority guess (section 4). The model has no physics inside: it fits ISS test results and flags where they stop.
      </Callout>

      <Disclosure summary="Technical details" tone="strong">
        <div className="space-y-6 pt-2">
          <Sub title="What it predicts">
            <P>
              The chance a flame is <strong>sustained</strong> (keeps burning) at one recorded airflow step. Airflow is that step&apos;s value, not a cabin average. Each material and flame type is modelled on its own.
            </P>
          </Sub>

          <Sub title="Inputs">
            <Formula label="Model inputs">{`x1 = oxygen concentration, % by volume
x2 = ln(1 + airflow in cm/s)
x3 = ln(total pressure / 101.325 kPa)`}</Formula>
            <P>
              Oxygen and pressure are kept separate: the same oxygen pressure at lower total pressure is not equivalent for flammability (NASA study NTRS 20160001047, listed in section 6). The ISS data all sit near 1 atm, so the model cannot say how
              the two trade off.
            </P>
            <P>
              &quot;Nearby&quot; uses the same inputs with fixed scales ({inline(methodology, (m) => <CoverageScales v={m.config.coverage_scales} />)}). Two tests are nearby when their combined scaled distance is at most 1 step (1 step = 2 points of oxygen,
              or 0.5 in ln(1 + airflow), or 0.1 in ln pressure).
            </P>
          </Sub>

          <Sub title="Method: Gaussian process (a flexible curve fit)">
            <P>
              The model is a Gaussian-process classifier with a Laplace approximation (a fast, approximate way to get the answer), following Rasmussen and Williams (2006). One length scale per input says how far a test result &quot;reaches&quot;. The
              starting average is a constant, the same for every group.
            </P>
            <Formula label="Predictive probability">{`P(sustained | x) = E[ sigmoid(f(x)) ],   f(x) ~ N(mean(x), var(x))
(Gauss-Hermite quadrature; var(x) is the Laplace posterior variance)`}</Formula>
            <P>
              <strong>Starting guesses (priors).</strong> Settings are fitted by MAP-II (picking the values that best fit the data, nudged by weak starting guesses on a log scale). The guesses are shown in the model card below. They are not estimates
              from NASA data.
            </P>
            <P>
              <strong>Pressure is fixed.</strong> ISS tests are all near 1 atm, so the data cannot teach the model about pressure. Its pressure length scale is fixed at{" "}
              {inline(methodology, (m) => <span className="num">{num(m.config.pressure_length_scale_default)}</span>)} (ln-pressure units), with a check at{" "}
              {inline(methodology, (m) => <span className="num">{((m.config as { pressure_length_scale_sensitivity?: number[] }).pressure_length_scale_sensitivity ?? []).map((x) => num(x)).join(" / ") || "—"}</span>)}.{" "}
              <strong>Any answer away from about 1 atm is assumption-driven.</strong>
            </P>
            <P>
              <strong>Stationarity (assumes the same pattern everywhere).</strong> Length scales are learned near 1 atm and the tested oxygen range, then assumed to hold everywhere. Far from the data the estimate drifts back to the material&apos;s
              base rate, so it can even fall as oxygen rises. That is drift, not combustion physics, and the coverage check withholds the estimate there.
            </P>
            <QueryBoundary query={metadata} rows={4}>
              {(meta) => <Card meta={meta} label={groupLabel} />}
            </QueryBoundary>
            {groupLabel ? <P className="text-muted">Card shown for the selection in section 4: {groupLabel}.</P> : null}
          </Sub>

          <Sub title="Simple models it is compared with">
            <Bullets>
              <li>
                <strong>Majority guess:</strong> always predict the more common outcome. Hard to beat when about nine in ten results are &quot;kept burning&quot;.
              </li>
              <li>
                <strong>Logistic curves</strong> on oxygen, and on oxygen plus airflow (L2-regularised: kept simple on purpose).
              </li>
              <li>
                <strong>Bootstrap ensemble</strong> (200 members): a second uncertainty estimate without a Gaussian process.
              </li>
            </Bullets>
          </Sub>

          <Sub title="Calibration (do 70% claims come true 70% of the time?)">
            <P>
              Checked, not forced: no recalibration is applied, so the model is called uncertainty-aware, not calibrated. Section 4 shows reliability diagrams (10 equal-width bins) and the expected calibration error (ECE), which reads high on small
              samples.
            </P>
          </Sub>

          <Sub title="Two kinds of uncertainty">
            <Formula label="Uncertainty decomposition (nats)">{`total     = H( E[p] )           entropy of the mean probability
aleatoric = E[ H(p) ]           outcome variability
epistemic = total - aleatoric   knowledge uncertainty (mutual information)`}</Formula>
            <P>
              <strong>Knowledge uncertainty</strong> (epistemic) shrinks as more nearby experiments are added. <strong>Outcome variability</strong> (aleatoric) does not: if near-identical settings sometimes burn and sometimes go out, about 50 % is the
              honest answer. The &quot;uncertainty ratio&quot; compares the model&apos;s remaining uncertainty to its starting uncertainty (0 = fully set by data, 1 = no better than the starting guess).
            </P>
          </Sub>

          <Sub title="Coverage rules">
            <P>Each point gets a verdict from the ISS tests for that material. The thresholds are fixed constants in the analysis code, not tuned.</P>
            <Table>
              <caption className="sr-only">Coverage rules for one point</caption>
              <TableHeader>
                <TableRow>
                  <TableHead>Point verdict</TableHead>
                  <TableHead>Rule</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="h-auto whitespace-nowrap py-2 align-top font-medium">Supported</TableCell>
                  <TableCell className="h-auto py-2">Inside the range of ISS tests, or at least 3 nearby tests, <em>and</em> uncertainty ratio below 0.6.</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="h-auto whitespace-nowrap py-2 align-top font-medium">Insufficient evidence</TableCell>
                  <TableCell className="h-auto py-2">No nearby test and uncertainty ratio above 0.85. The app says: &quot;Insufficient experimental evidence for a reliable estimate.&quot;</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="h-auto whitespace-nowrap py-2 align-top font-medium">Extrapolation</TableCell>
                  <TableCell className="h-auto py-2">Everything else.</TableCell>
                </TableRow>
              </TableBody>
            </Table>
            <P>
              <strong>Whole cabin.</strong> A cabin is a grid of points over its oxygen, pressure and airflow ranges. It is <strong>insufficient evidence</strong> when no point has a nearby test, <strong>supported</strong> when at least 50 % of
              points are supported, and <strong>extrapolation</strong> otherwise. The count is always shown (for example &quot;19 of 27 target points supported&quot;). The chance of burning is shown only for supported points, and never when none is
              supported. Candidates follow the same rule.
            </P>
            <P>
              Listed reasons: fewer than 3 nearby tests; outside the tested range; tested pressure more than 0.1 ln units (about 10 %) away; mixed outcomes (over 60 % of the uncertainty is outcome variability while the ratio is below 0.5). For a cabin, reasons
              that hit at least half its points are listed.
            </P>
          </Sub>
        </div>
      </Disclosure>
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
