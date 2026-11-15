"use client";

import { Callout } from "@/components/ui/callout";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ApiQuery } from "@/hooks/api";
import type { MethodologyResponse } from "@/lib/types";
import { CANDIDATE_DISCLAIMER } from "@/lib/format";
import { Bullets, Formula, Mono, P, Section, Sub, inline } from "./primitives";

function domainText(d: unknown): string {
  if (typeof d !== "object" || d === null) return "not reported";
  const r = d as Record<string, unknown>;
  const rng = (v: unknown, unit: string) => (Array.isArray(v) && v.length === 2 ? `${v[0]} to ${v[1]} ${unit}` : "—");
  return `oxygen ${rng(r.oxygen_percent, "%")}; pressure ${rng(r.pressure_kpa, "kPa")}; airflow ${rng(r.airflow_cm_s, "cm/s")}`;
}

export function ActiveLearningSection({ methodology }: { methodology: ApiQuery<MethodologyResponse> }) {
  return (
    <Section
      id="active-learning"
      number={3}
      title="Active learning"
      intro="How computational research candidates are proposed and ranked: by how much a hypothetical new observation would reduce uncertainty about the selected cabin atmosphere."
    >
      <Sub title="Candidate generation">
        <P>
          Candidates are points in the same analysis group (same material family and flame configuration) on a grid over a documented domain:{" "}
          <span className="num">{inline(methodology, (m) => domainText(m.config.candidate_domain))}</span>. Oxygen steps in 1-point increments, airflow takes 12 log-spaced values, and pressure takes a fixed list of values;
          the target pressure is added when no grid pressure lies within 1 kPa of it.
        </P>
      </Sub>

      <Sub title="Ranking score: expected uncertainty reduction">
        <P>
          Let <Mono>f</Mono> be the latent function, <Mono>S</Mono> its posterior covariance, <Mono>t</Mono> the points of the target region with weights <Mono>w_t</Mono> (summing to 1) and <Mono>c</Mono> a candidate. Observing one
          outcome at <Mono>c</Mono> reduces the weighted variance of <Mono>f</Mono> over the target by:
        </P>
        <Formula label="Expected variance reduction">{`EVR(c)  =  sum_t  w_t * S(t, c)^2  *  F_c

F_c     =  sum_y  p_y / ( S(c, c) + 1 / W(f_y) )

W(f)    =  sigmoid(f) * (1 - sigmoid(f))
f_y     =  1-D Laplace mode of f(c) after a hypothetical outcome y
p_y     =  current predictive probability of outcome y

expected uncertainty reduction(c) = EVR(c) / ( sum_t  w_t * S(t, t) )`}</Formula>
        <Bullets>
          <li>
            <Mono>S(t, c)</Mono> is large when the candidate and the target are correlated under the kernel. A candidate far from the target, or one that is already well constrained, scores low.
          </li>
          <li>
            <Mono>F_c</Mono> averages, over the two possible outcomes y weighted by their current predictive probability <Mono>p_y</Mono>, the Laplace information that a binary observation adds at <Mono>c</Mono>:{" "}
            <Mono>f_y</Mono> is the one-dimensional Laplace mode of the candidate&apos;s latent value after a hypothetical outcome <Mono>y</Mono> (prior: its current mean and variance) and <Mono>W(f) = sigmoid(f)(1 - sigmoid(f))</Mono> is the Laplace curvature. Outcomes that are nearly certain are less informative than those near the decision boundary.
          </li>
          <li>The score is the share of the current latent (logit-scale) variance over the target that one hypothetical observation is expected to remove. It is a ranking heuristic on the Laplace approximation, not an exact expected information gain.</li>
          <li>
            <strong>Stationarity.</strong> The covariance <Mono>S(t, c)</Mono> comes from a kernel that depends only on distance, with length scales learned near 1 atm and the tested oxygen range. Where no integrated data constrain the target, the score
            follows that assumption alone, so the most informative single experiment is often at the target conditions themselves. The interface says so when the top candidate lies within 1 reference distance of the target.
          </li>
          <li>
            Mutual-information reduction on the target (<Mono>mi_reduction_fraction</Mono>) is reported alongside, computed from the updated variances with latent means held fixed.
          </li>
        </Bullets>
      </Sub>

      <Sub title="Batch selection">
        <P>
          For a batch of <Mono>k</Mono> candidates, selection is greedy: after each pick the joint covariance of target and candidates is updated by a rank-one downdate that assumes the picked outcome is observed, and the
          next candidate is chosen by its remaining (marginal) EVR. This avoids proposing near-duplicate points. Ties go to the lowest grid index, so results are deterministic.
        </P>
      </Sub>

      <Sub title="Target relevance">
        <Bullets>
          <li>
            The target is a documented atmosphere profile or a user-selected hypothetical set of conditions (always labelled as such). The target region is a grid of points over its oxygen, pressure and airflow ranges.
          </li>
          <li>
            Airflow: the profile&apos;s airflow band when it has one; otherwise from 0.5 cm/s up to the maximum of the NASA-STD-3001 ventilation range, reported as &quot;NASA-STD-3001 ventilation range, extended down to 0.5 cm/s&quot;. The extension below the standard&apos;s minimum is an analysis choice (ventilation loss or dead zones), not a documented cabin value.
          </li>
          <li>
            If a profile gives no nominal oxygen but a maximum, the maximum is analysed and flagged as a documented upper bound (higher oxygen is the worst case for flammability). A nominal is never invented. Crew
            envelope profiles are context only and cannot be targets.
          </li>
        </Bullets>
      </Sub>

      <Sub title="Baselines">
        <Table>
          <caption className="sr-only">Selection baselines</caption>
          <TableHeader>
            <TableRow>
              <TableHead>Strategy</TableHead>
              <TableHead>What it picks</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="h-auto whitespace-nowrap py-2">Blind Spots (target-aware)</TableCell>
              <TableCell className="h-auto py-2">Largest expected uncertainty reduction over the target (above).</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="h-auto whitespace-nowrap py-2">Uncertainty sampling</TableCell>
              <TableCell className="h-auto py-2">Largest knowledge (epistemic) uncertainty at the candidate itself; ignores the target.</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="h-auto whitespace-nowrap py-2">Nearest gap</TableCell>
              <TableCell className="h-auto py-2">Candidate closest to the target centre (in reference distances) among candidates in a coverage gap (nearest observation more than 1 reference distance away).</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="h-auto whitespace-nowrap py-2">Random</TableCell>
              <TableCell className="h-auto py-2">Uniform draw from the candidate set, seeded deterministically from the request.</TableCell>
            </TableRow>
          </TableBody>
        </Table>
        <P>
          Every ranking shows each baseline&apos;s pick scored with the same expected uncertainty reduction: the expected reduction if that baseline&apos;s pick were tested instead. Because the target-aware pick maximises this score, it is
          highest by construction; the fair, out-of-sample comparison is the retrospective replay in section 4.
        </P>
      </Sub>

      <Sub title="Sensitivity analysis">
        <P>
          Because pressure cannot be learned from the data, the ranking is recomputed with pressure length scales{" "}
          <span className="num">{inline(methodology, (m) => ((m.config as { pressure_length_scale_sensitivity?: number[] }).pressure_length_scale_sensitivity ?? []).join(" / ") || "—")}</span>. The response states whether the top
          candidate changes. A candidate is flagged as assumption-dependent when its expected uncertainty reduction varies across those settings by more than half of its largest value. Two candidates are reported as indistinguishable when their scores differ by less than 15 % (relative) or the preference flips under any setting.
        </P>
      </Sub>

      <Sub title="Feasibility labels (never claims)">
        <Bullets>
          <li>
            <strong>Within demonstrated envelope</strong>: inside the observed bounding box and convex hull of the integrated investigations. Text: &quot;Inside conditions already run in the integrated investigations (not an engineering
            feasibility assessment).&quot;
          </li>
          <li>
            <strong>Outside demonstrated envelope</strong>: &quot;Feasibility not verified; requires qualified review.&quot;
          </li>
          <li>
            Each candidate inside the documented test envelope of a NASA investigation that is not integrated lists it (for example a Saffire or SoFIE run), noting that existing data may already inform the candidate.
          </li>
        </Bullets>
        <Callout variant="info">{CANDIDATE_DISCLAIMER}</Callout>
      </Sub>

      <Sub title="Counterfactual previews">
        <P>
          For a chosen candidate, the model is conditioned on each hypothetical outcome in turn (flame sustained, flame not sustained) with hyperparameters held fixed. The preview shows the resulting target probability and variance,
          the probability of each outcome under the current model, and the expected uncertainty reduction. These are <strong>hypothetical outcomes and model updates, not experimental results</strong>.
        </P>
      </Sub>
    </Section>
  );
}
