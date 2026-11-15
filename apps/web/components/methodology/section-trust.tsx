"use client";

import type { ReactNode } from "react";
import type { ApiQuery } from "@/hooks/api";
import type { GroupSummary, HeadlineResponse } from "@/lib/types";
import { fmtCount } from "@/lib/format";
import { materialFullName, materialName } from "@/components/home/cabins";
import type { ExtValidation } from "./types";
import { blindspotShortfall, VERDICT_WORD } from "./labels";
import { QueryBoundary } from "./primitives";
import { Disclosure } from "@/components/ui/disclosure";
import { modelOf as model, retroSummary, retroVsRandom, vsMajority } from "./summary";

const f = (v: number | null | undefined, d = 2): string => (typeof v === "number" && Number.isFinite(v) ? v.toFixed(d) : "—");

function Tile({ value, label, note }: { value: string; label: string; note: string }) {
  return (
    <div className="min-w-0 rounded-md border border-border bg-surface px-4 py-3">
      <div className="num text-[22px] font-medium leading-tight tracking-[-0.01em] text-fg">
        {(() => {
          const m = /^(\d+) (of \d+)$/.exec(value);
          return m ? (
            <>
              {m[1]} <span className="text-[14px] font-normal text-muted">{m[2]}</span>
            </>
          ) : (
            value
          );
        })()}
      </div>
      <div className="mt-1 text-[13px] font-medium text-fg">{label}</div>
      <div className="mt-0.5 text-xs leading-snug text-muted">{note}</div>
    </div>
  );
}

/** Placeholder text block: wraps like the text it stands in for, so the section keeps its loaded height. */
function Ghost({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={`rounded-sm bg-subtle text-transparent [box-decoration-break:clone] motion-safe:animate-pulse ${className ?? ""}`}>{children}</span>;
}

/** Loading state with the loaded layout's structure (lead, tiles, limits, collapsed table), so later sections do not shift. */
function TrustSkeleton() {
  const tiles = [
    ["materials where the model beats a simple guess", "A simple guess is always picking the most common result. Checked on ISS experiments it had not seen. Clearly worse in none. 0 of the 0 are acrylic-sphere setups."],
    ["materials where its uncertainty rises when it is wrong", "Inconclusive in 00, not shown in 00. 0 of the 0 are acrylic-sphere setups, whose flame-went-out results are mostly airflow being switched off."],
    ["past-experiment replays where the ranking beat random picks", "Tied in 00, worse in 0. Against \"test the nearest gap\": better in 00, worse in 0."],
    ["recorded pressure of the ISS test results", "Recorded for 000 of 000 results; the other 000 are assumed at normal ISS cabin pressure. Away from this the model says it does not know."],
  ];
  return (
    <div role="status" aria-label="Loading the validation summary">
      <div aria-hidden className="space-y-6">
        <p className="max-w-[68ch] text-[16px] leading-relaxed">
          <Ghost>Short answer: partly. Tested on experiments it did not see, the model beats a simple guess in 00 of 00 materials. Where the ISS tests give it no evidence, it says so instead of guessing.</Ghost>
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {tiles.map(([label, note]) => (
            <div key={label} className="min-w-0 rounded-md border border-border bg-surface px-4 py-3">
              <div className="num text-[22px] font-medium leading-tight tracking-[-0.01em]"><Ghost>00 of 00</Ghost></div>
              <div className="mt-1 text-[13px] font-medium"><Ghost>{label}</Ghost></div>
              <div className="mt-0.5 text-xs leading-snug"><Ghost>{note}</Ghost></div>
            </div>
          ))}
        </div>
        <div className="max-w-[78ch] space-y-2">
          <h3 className="text-[14px] font-semibold"><Ghost>Read the results with these limits</Ghost></h3>
          <ul className="space-y-1.5 pl-5 text-[14px] leading-relaxed">
            {[
              "The uncertainty check passes for only 0 of 0 materials: acrylic rod (PMMA) and acrylic sphere (PMMA). Without the steps where the airflow was switched off, only 0 to 00 flame-went-out results remain in each of them, so treat the check as unproven for real flame-out boundaries.",
              "Gravity is not modelled. All the ISS tests ran in microgravity (free fall). The Moon and Mars have partial gravity, and the challenge notes that PSI holds no partial-gravity combustion data, so this site judges the air only.",
              "The model reports uncertainty but is not tuned to be exactly right about it: in 00 of 00 materials its stated chances match reality less well than a constant guess (section 4).",
              "The ranking beats random picks in 00 of 00 replays, but not the simple rule \"test the nearest gap\" (0 better, 00 tied, 0 worse). The replays share materials, so they are not independent.",
              "Every ISS test ran near sea-level pressure, so the model has not learned any pressure effect. At other pressures, and beyond the tested oxygen range, it falls back to the average for that material and withholds the probability (section 2).",
            ].map((t) => (
              <li key={t}><Ghost>{t}</Ghost></li>
            ))}
          </ul>
        </div>
        <div className="min-h-6 text-ui"><Ghost>Results for each material</Ghost></div>
      </div>
    </div>
  );
}

/** "Can you trust it?": a plain-language summary computed from GET /api/model/validation and /api/groups. */
export function TrustSection({
  validation,
  groups,
  headline,
  onShowGroup,
}: {
  validation: ApiQuery<ExtValidation>;
  headline: ApiQuery<HeadlineResponse>;
  groups: GroupSummary[] | undefined;
  onShowGroup: (groupId: string) => void;
}) {
  const label = (id: string) => materialFullName(id, groups?.find((g) => g.group_id === id)?.label ?? id);
  return (
    <section id="trust" aria-labelledby="trust-h" className="scroll-mt-[calc(var(--header-h)+16px)]">
      <h2 id="trust-h" className="text-[20px] font-semibold tracking-[-0.015em]">
        Can you trust it?
      </h2>
      <p className="mt-2 max-w-[68ch] text-[13px] leading-relaxed text-muted">
        Worked out from the checks in section 4 of the technical details below. The model is always scored on experiments it did not see during training.
      </p>
      <div className="mt-5">
        {validation.isPending ? <TrustSkeleton /> : (
        <QueryBoundary query={validation} rows={4}>
          {(v) => {
            const gs = v.groups;
            if (gs.length === 0) return <p className="text-[14px] text-muted">No validation results are available.</p>;
            const better = gs.filter((g) => vsMajority(g) === "better");
            const worse = gs.filter((g) => vsMajority(g) === "worse");
            const bsSupported = gs.filter((g) => g.blindspot_test.verdict === "supported");
            const bsInconclusive = gs.filter((g) => g.blindspot_test.verdict === "inconclusive");
            const summary = retroSummary(v);
            const vr = summary?.evr_vs_random;
            const vg = summary?.evr_vs_nearest_gap;
            const eceWorse = gs.filter((g) => {
                const a = model(g, "gp")?.ece.value;
                const b = model(g, "majority_class")?.ece.value;
                return typeof a === "number" && typeof b === "number" && a > b;
              }).length;
            // Pressure: only some results have a recorded value; the rest carry an assumed one (headline envelope fields).
            const env = headline.data?.data.envelope;
            const pr = env?.pressure_measured_kpa ?? null;
            const nAssumed = typeof env?.n_steps_pressure_assumed === "number" ? env.n_steps_pressure_assumed : null;
            const nSteps = typeof env?.n_steps === "number" ? env.n_steps : null;
            // The acrylic-sphere setups behind many of the passes (their flame-went-out results are mostly airflow being switched off).
            const spheres = (xs: typeof gs) => xs.filter((g) => g.group_id.startsWith("pmma_sphere")).length;
            const supportedFacts = bsSupported.map((g) => {
              const fo = g.sensitivity.find((s) => /flow_off/i.test(s.variant));
              return { mis: g.blindspot_test.point_level.n_misclassified, left: fo?.n_not_sustained };
            });
            const leftVals = supportedFacts.map((x) => x.left).filter((x): x is number => typeof x === "number");
            const span = (xs: number[], sep = "–") => (xs.length ? (Math.min(...xs) === Math.max(...xs) ? `${Math.min(...xs)}` : `${Math.min(...xs)}${sep}${Math.max(...xs)}`) : null);
            const passFamilies = [...new Set(bsSupported.map((g) => materialName(g.group_id, groups?.find((x) => x.group_id === g.group_id)?.label ?? g.group_id)))].map((n) => (/^(Nomex|Ultem)\b/.test(n) ? n : n.charAt(0).toLowerCase() + n.slice(1)));
            return (
              <div className="space-y-6">
                <p className="max-w-[68ch] text-[16px] leading-relaxed" data-testid="trust-lead">
                  Short answer: partly. Tested on experiments it did not see, the model beats a simple guess in {better.length} of {gs.length} materials. Where the ISS tests give it no evidence, it says so instead of guessing.
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <Tile
                    value={`${better.length} of ${gs.length}`}
                    label="materials where the model beats a simple guess"
                    note={`A simple guess is always picking the most common result. Checked on ISS experiments it had not seen. ${worse.length === 0 ? "Clearly worse in none." : `Clearly worse in ${worse.length}.`}${spheres(better) ? ` ${spheres(better)} of the ${better.length} are acrylic-sphere setups.` : ""}`}
                  />
                  <Tile
                    value={`${bsSupported.length} of ${gs.length}`}
                    label="materials where its uncertainty rises when it is wrong"
                    note={`Inconclusive in ${bsInconclusive.length}${gs.length - bsSupported.length - bsInconclusive.length ? `, not shown in ${gs.length - bsSupported.length - bsInconclusive.length}` : ""}.${spheres(bsSupported) ? ` ${spheres(bsSupported)} of the ${bsSupported.length} are acrylic-sphere setups, whose flame-went-out results are mostly airflow being switched off.` : ""}`}
                  />
                  {vr && summary ? (
                    <Tile
                      value={`${vr.better} of ${summary.n_scenarios}`}
                      label="past-experiment replays where the ranking beat random picks"
                      note={`Tied in ${vr.indistinguishable}, worse in ${vr.worse}.${vg ? ` Against "test the nearest gap": better in ${vg.better}, worse in ${vg.worse}.` : ""}`}
                    />
                  ) : null}
                  {pr && nAssumed !== null && nSteps !== null ? (
                    <Tile
                      value={`${f(pr[0], 0)}–${f(pr[1], 0)} kPa`}
                      label="recorded pressure of the ISS test results"
                      note={`Recorded for ${fmtCount(nSteps - nAssumed)} of ${fmtCount(nSteps)} results; the other ${fmtCount(nAssumed)} are assumed at normal ISS cabin pressure. Away from this the model says it does not know.`}
                    />
                  ) : null}
                </div>

                <div className="max-w-[78ch] space-y-2">
                  <h3 className="text-[14px] font-semibold">Read the results with these limits</h3>
                  <ul className="list-disc space-y-1.5 pl-5 text-[14px] leading-relaxed marker:text-muted">
                    {bsSupported.length ? (
                      <li>
                        The uncertainty check passes for only {bsSupported.length} of {gs.length} materials: {passFamilies.join(" and ")}.
                        {span(leftVals) !== null ? ` Without the steps where the airflow was switched off, only ${span(leftVals, " to ")} flame-went-out results remain in each of them,` : ""} so treat the check as unproven for real flame-out boundaries.
                      </li>
                    ) : null}
                    <li>
                      <strong className="font-medium">Gravity is not modelled.</strong> All the ISS tests ran in microgravity (free fall). The Moon and Mars have partial gravity, and the challenge notes that PSI holds no partial-gravity combustion data, so this site judges the air only.
                    </li>
                    <li>
                      The model reports uncertainty but is not tuned to be exactly right about it: in {eceWorse} of {gs.length} materials its stated chances match reality less well than a constant guess (section 4).
                    </li>
                    {vg ? (
                      <li>
                        The ranking beats random picks in {vr?.better ?? "—"} of {summary?.n_scenarios ?? "—"} replays, but not the simple rule &quot;test the nearest gap&quot; ({vg.better} better, {vg.indistinguishable} tied, {vg.worse} worse). The replays share materials, so they are not independent.
                      </li>
                    ) : null}
                    <li>
                      Every ISS test ran near sea-level pressure, so the model has not learned any pressure effect. At other pressures, and beyond the tested oxygen range, it falls back to the average for that material and withholds the probability (section 2).
                    </li>
                  </ul>
                </div>

                <Disclosure summary="Results for each material" tone="strong" contentClassName="mt-3 pl-0" data-testid="trust-by-group">
                  <div className="relative overflow-x-auto rounded-md border border-border bg-surface" tabIndex={0} role="region" aria-label="Validation summary by material">
                    <table className="w-full min-w-[720px] border-collapse text-[13px]">
                      <caption className="sr-only">Checks on unseen experiments, by material</caption>
                      <thead>
                        <tr className="border-b border-border bg-subtle text-left text-xs text-muted">
                          <th scope="col" className="px-3 py-2 font-medium">Material and airflow</th>
                          <th scope="col" className="px-3 py-2 text-right font-medium">Experiments</th>
                          <th scope="col" className="px-3 py-2 font-medium">Versus a simple guess</th>
                          <th scope="col" className="px-3 py-2 font-medium">Uncertainty check</th>
                          <th scope="col" className="px-3 py-2 text-right font-medium">
                            Ranking vs random
                            <div className="font-normal">better / tied / worse</div>
                          </th>
                          <th scope="col" className="px-3 py-2"><span className="sr-only">Details</span></th>
                        </tr>
                      </thead>
                      <tbody>
                        {gs.map((g) => {
                          const vs = vsMajority(g);
                          const gp = model(g, "gp")?.log_loss.value;
                          const mj = model(g, "majority_class")?.log_loss.value;
                          const short = blindspotShortfall(g);
                          const rr = retroVsRandom(v, g.group_id);
                          return (
                            <tr key={g.group_id} className="border-b border-border last:border-b-0 align-top">
                              <th scope="row" className="w-[30%] px-3 py-2 text-left font-medium">{label(g.group_id)}</th>
                              <td className="num px-3 py-2 text-right">{fmtCount(g.n_experiments)}</td>
                              <td className="px-3 py-2">
                                <span className={vs === "better" ? "font-medium text-fg" : "text-fg"}>
                                  {vs === "better" ? "Better" : vs === "worse" ? "Worse" : vs === "same" ? "No clear difference" : "Not checked"}
                                </span>
                                <div className="num whitespace-nowrap text-xs text-muted">
                                  {f(gp, 3)} vs {f(mj, 3)}
                                </div>
                              </td>
                              <td className="px-3 py-2">
                                <span className={g.blindspot_test.verdict === "supported" ? "font-medium text-fg" : "text-fg"}>{VERDICT_WORD[g.blindspot_test.verdict] ?? g.blindspot_test.verdict}</span>
                                {short ? <div className="text-xs leading-snug text-muted">{short}</div> : null}
                              </td>
                              <td className="num whitespace-nowrap px-3 py-2 text-right">
                                {rr.n ? (
                                  <span aria-label={`${rr.better} better, ${rr.same} tied, ${rr.worse} worse`}>
                                    {rr.better} / {rr.same} / {rr.worse}
                                  </span>
                                ) : (
                                  <span className="text-muted">no replay</span>
                                )}
                              </td>
                              <td className="px-3 py-1.5 text-right">
                                <button
                                  type="button"
                                  onClick={() => onShowGroup(g.group_id)}
                                  className="inline-flex min-h-7 items-center rounded-sm px-1.5 text-xs text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent"
                                >
                                  Details<span className="sr-only"> for {label(g.group_id)}</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-2 max-w-[78ch] text-xs leading-relaxed text-muted">
                    The two numbers under each verdict are a score where lower is better (log loss): the model first, the simple guess second. Every score is measured on experiments the model did not see. &quot;Better&quot; means a 95 % interval of the
                    difference lies entirely on the model&apos;s side. Ranking vs random: replays on past ISS experiments in which each strategy picks tests one at a time (section 4).
                  </p>
                </Disclosure>

              </div>
            );
          }}
        </QueryBoundary>
        )}
      </div>
    </section>
  );
}
