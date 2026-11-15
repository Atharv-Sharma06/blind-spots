"use client";

import { Callout } from "@/components/ui/callout";
import { Disclosure } from "@/components/ui/disclosure";
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
    <Section id="active-learning" number={3} title="Active learning" intro="How the app picks which hypothetical test to suggest next.">
      <Bullets>
        <li>The app lists many possible tests for the same material and flame type.</li>
        <li>For each one it asks: how much would one new result shrink the model&apos;s uncertainty about your cabin air?</li>
        <li>The test that shrinks it most ranks first.</li>
        <li>Tests close to your cabin conditions usually rank high.</li>
        <li>Nothing here is an experimental result.</li>
      </Bullets>

      <Callout variant="info">{CANDIDATE_DISCLAIMER}</Callout>

      <Disclosure summary="Technical details" tone="strong" className="card rounded-[var(--radius-xl)] bg-surface px-4 sm:px-5" summaryClassName="flex w-full min-h-12 text-[14px] hover:text-accent" contentClassName="pb-4">
        <div className="space-y-6 pt-2">
          <Sub title="Which tests are considered">
            <P>
              A grid of conditions for the same material and flame type, over <span className="num">{inline(methodology, (m) => domainText(m.config.candidate_domain))}</span>. Oxygen moves in 1-point steps, airflow takes 12 log-spaced values, and
              pressure takes a fixed list. The cabin&apos;s own pressure is added if no listed pressure is within 1 kPa of it.
            </P>
          </Sub>

          <Sub title="Score: expected uncertainty reduction (EVR)">
            <P>
              In plain terms: how much one new test would be expected to shrink the model&apos;s uncertainty over the cabin. Here <Mono>f</Mono> is the model&apos;s hidden score for flammability, <Mono>S</Mono> its uncertainty, <Mono>t</Mono> the cabin
              points with weights <Mono>w_t</Mono> (summing to 1) and <Mono>c</Mono> a candidate test.
            </P>
            <Formula label="Expected variance reduction">{`EVR(c)  =  sum_t  w_t * S(t, c)^2  *  F_c

F_c     =  sum_y  p_y / ( S(c, c) + 1 / W(f_y) )

W(f)    =  sigmoid(f) * (1 - sigmoid(f))
f_y     =  1-D Laplace mode of f(c) after a hypothetical outcome y
p_y     =  current predictive probability of outcome y

expected uncertainty reduction(c) = EVR(c) / ( sum_t  w_t * S(t, t) )`}</Formula>
            <Bullets>
              <li>
                <Mono>S(t, c)</Mono> is large when the test and the cabin are correlated. A test far from the cabin, or one already well pinned down, scores low.
              </li>
              <li>
                <Mono>F_c</Mono> averages the information a yes/no result adds at <Mono>c</Mono>, weighted by how likely each outcome <Mono>y</Mono> is now. Near-certain outcomes teach less than toss-ups.
              </li>
              <li>The score is the share of current uncertainty over the cabin that one test is expected to remove. It is a ranking rule on an approximation (Laplace), not exact information gain.</li>
              <li>
                <strong>Stationarity (assumes the same pattern everywhere).</strong> Where no ISS data constrain the cabin, the score follows that assumption alone, so the best single test is often at the cabin conditions themselves. The app says so when
                the top pick is within 1 step of the cabin.
              </li>
              <li>
                Mutual-information reduction (<Mono>mi_reduction_fraction</Mono>) is reported alongside, from the updated variances with the means held fixed.
              </li>
            </Bullets>
          </Sub>

          <Sub title="Picking a batch">
            <P>
              For <Mono>k</Mono> tests, picks are greedy: after each pick the model updates as if that outcome were seen, then the next test is chosen by its remaining score. This avoids near-duplicates. Ties go to the lowest grid index, so results repeat
              exactly.
            </P>
          </Sub>

          <Sub title="Which cabin it aims at">
            <Bullets>
              <li>A documented atmosphere profile, or conditions you choose (always labelled hypothetical), as a grid of points over its oxygen, pressure and airflow ranges.</li>
              <li>
                Airflow: the profile&apos;s band if it has one. Otherwise 0.5 cm/s up to the top of the NASA-STD-3001 ventilation range, shown as &quot;NASA-STD-3001 ventilation range, extended down to 0.5 cm/s&quot;. The extension below the standard is an
                analysis choice (ventilation loss or dead zones), not a documented cabin value.
              </li>
              <li>
                If a profile gives a maximum oxygen but no nominal, the maximum is used and flagged as an upper bound (more oxygen is the worst case). A nominal is never invented. Crew-envelope profiles are context only, never targets.
              </li>
            </Bullets>
          </Sub>

          <Sub title="Simple rules it is compared with">
            <Table containerClassName="rounded-[var(--radius-lg)] border-border/70">
              <caption className="sr-only">Selection baselines</caption>
              <TableHeader>
                <TableRow>
                  <TableHead>Strategy</TableHead>
                  <TableHead>What it picks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="h-auto whitespace-nowrap py-2">Blind Spots (aims at the cabin)</TableCell>
                  <TableCell className="h-auto py-2">Largest expected uncertainty reduction over the cabin.</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="h-auto whitespace-nowrap py-2">Most unsure point</TableCell>
                  <TableCell className="h-auto py-2">Where the model&apos;s knowledge uncertainty is highest; ignores the cabin.</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="h-auto whitespace-nowrap py-2">Nearest gap</TableCell>
                  <TableCell className="h-auto py-2">Closest to the cabin centre among points with no ISS test within 1 step.</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="h-auto whitespace-nowrap py-2">Random</TableCell>
                  <TableCell className="h-auto py-2">A random point, seeded from the request so it repeats.</TableCell>
                </TableRow>
              </TableBody>
            </Table>
            <P>
              Each rule&apos;s pick is scored with the same expected uncertainty reduction. Blind Spots wins this by construction; the fair comparison is the replay in section 4.
            </P>
          </Sub>

          <Sub title="Does the pressure assumption matter?">
            <P>
              Pressure cannot be learned from the data, so the ranking is recomputed at pressure length scales{" "}
              <span className="num">{inline(methodology, (m) => ((m.config as { pressure_length_scale_sensitivity?: number[] }).pressure_length_scale_sensitivity ?? []).join(" / ") || "—")}</span>. The response says whether the top pick changes. A
              pick is flagged assumption-dependent when its score varies by more than half its largest value. Two picks are called indistinguishable when scores differ by under 15 % or the order flips under any setting.
            </P>
          </Sub>

          <Sub title="Feasibility labels (never claims)">
            <Bullets>
              <li>
                <strong>Within demonstrated envelope</strong>: inside the range of conditions the ISS tests have covered. &quot;Inside conditions already run in the integrated investigations (not an engineering feasibility assessment).&quot;
              </li>
              <li>
                <strong>Outside demonstrated envelope</strong>: &quot;Feasibility not verified; requires qualified review.&quot;
              </li>
              <li>A pick inside the test range of another NASA investigation (for example Saffire or SoFIE) lists it, since that data may already help.</li>
            </Bullets>
          </Sub>

          <Sub title="What-if previews">
            <P>
              For a chosen test, the model is updated with each outcome in turn (flame kept burning, flame went out), with settings held fixed. The preview shows the new cabin probability and uncertainty, how likely each outcome is now, and the expected
              uncertainty reduction. Hypothetical model updates, not experimental results.
            </P>
          </Sub>
        </div>
      </Disclosure>
    </Section>
  );
}
