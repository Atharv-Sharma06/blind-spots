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

      <Sub title="Acquisition: expected variance reduction (EVR)">
        <P>
          Let <Mono>f</Mono> be the latent function, <Mono>S</Mono> its posterior covariance, <Mono>t</Mono> the points of the target region with weights <Mono>w_t</Mono> (summing to 1) and <Mono>c</Mono> a candidate. Observing one
          outcome at <Mono>c</Mono> reduces the weighted variance of <Mono>f</Mono> over the target by:
        </P>
        <Formula label="Expected variance reduction">{`EVR(c)  =  sum_t  w_t * S(t, c)^2  *  F_c

F_c     =  sum_y  p_y / ( S(c, c) + 1 / W(f_y) )

W(f)    =  sigmoid(f) * (1 - sigmoid(f))
f_y     =  latent mean at c after conditioning on outcome y
p_y     =  current predictive probability of outcome y

EVR fraction(c) = EVR(c) / ( sum_t  w_t * S(t, t) )`}</Formula>
        <Bullets>
          <li>
            <Mono>S(t, c)</Mono> is large when the candidate and the target are correlated under the kernel. A candidate far from the target, or one that is already well constrained, scores low.
          </li>
          <li>
            <Mono>F_c</Mono> averages, over the two possible outcomes y weighted by their current predictive probability <Mono>p_y</Mono>, the Laplace information that a binary observation adds at <Mono>c</Mono>:{" "}
            <Mono>f_y</Mono> is the latent mean after conditioning on outcome <Mono>y</Mono> and <Mono>W(f) = sigmoid(f)(1 - sigmoid(f))</Mono> is the Laplace curvature. Outcomes that are nearly certain are less informative than those near the decision boundary.
          </li>
          <li>The ranking quantity is a Gaussian-surrogate approximation to the Laplace posterior; it is a ranking heuristic, not an exact expected information gain.</li>
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
            Airflow: the profile&apos;s airflow band when it has one; otherwise from 0.5 cm/s up to the maximum of the NASA-STD-3001 ventilation range, reported as{" "}
            <Mono>ventilation_standard_with_near_quiescent_extension</Mono>. The extension below the standard&apos;s minimum is an analysis choice (ventilation loss or dead zones), not a documented cabin value.
          </li>
          <li>
            If a profile gives no nominal oxygen but a maximum, the maximum is analysed and flagged <Mono>documented_upper_bound_used</Mono> (higher oxygen is the worst case for flammability). A nominal is never invented. Crew
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
              <TableCell className="num h-auto py-2">evr</TableCell>
              <TableCell className="h-auto py-2">Largest expected reduction of target variance (above).</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="num h-auto py-2">uncertainty_sampling</TableCell>
              <TableCell className="h-auto py-2">Largest epistemic uncertainty at the candidate itself; ignores the target.</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="num h-auto py-2">nearest_gap</TableCell>
              <TableCell className="h-auto py-2">Candidate closest to the target centroid (in scaled units) among candidates that lie in a coverage gap (nearest observation farther than 1 scaled unit).</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="num h-auto py-2">random</TableCell>
              <TableCell className="h-auto py-2">Uniform draw from the candidate set, seeded deterministically from the request.</TableCell>
            </TableRow>
          </TableBody>
        </Table>
        <P>Every ranking response includes each baseline&apos;s pick and its EVR, so the value of target-aware selection can be seen for the same request. Section 4 tests this retrospectively.</P>
      </Sub>

      <Sub title="Sensitivity analysis">
        <P>
          Because pressure cannot be learned from the data, the ranking is recomputed with pressure length scales{" "}
          <span className="num">{inline(methodology, (m) => ((m.config as { pressure_length_scale_sensitivity?: number[] }).pressure_length_scale_sensitivity ?? []).join(" / ") || "—")}</span>. The response states whether the top
          candidate changes. A candidate is flagged <Mono>assumption_dependent</Mono> when its EVR fraction varies across those settings by more than half of its largest value. Two candidates are reported as{" "}
          <Mono>indistinguishable</Mono> when their EVR fractions differ by less than 15 % (relative) or the preference flips under any setting.
        </P>
      </Sub>

      <Sub title="Feasibility labels (never claims)">
        <Bullets>
          <li>
            <Mono>within_demonstrated_envelope</Mono>: inside the observed bounding box and convex hull of the integrated investigations. Text: &quot;Inside conditions already run in the integrated investigations (not an engineering
            feasibility assessment).&quot;
          </li>
          <li>
            <Mono>outside_demonstrated_envelope</Mono>: &quot;Feasibility not verified; requires qualified review.&quot;
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
          the probability of each outcome under the current model, and the expected variance reduction. These are <strong>hypothetical outcomes and model updates, not experimental results</strong>.
        </P>
      </Sub>
    </Section>
  );
}
