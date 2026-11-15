"use client";

import type { ReactNode } from "react";
import type { ApiQuery } from "@/hooks/api";
import type { GroupSummary, HeadlineResponse } from "@/lib/types";
import { fmtCount } from "@/lib/format";
import { materialFullName } from "@/components/home/cabins";
import type { ExtValidation } from "./types";
import { blindspotShortfall, VERDICT_WORD } from "./labels";
import { QueryBoundary } from "./primitives";
import { Disclosure } from "@/components/ui/disclosure";
import { DotNumber } from "@/components/ui/dot-number";
import { modelOf as model, retroSummary, retroVsRandom, vsMajority } from "./summary";

const f = (v: number | null | undefined, d = 2): string => (typeof v === "number" && Number.isFinite(v) ? v.toFixed(d) : "—");

function Tile({ value, label, note }: { value: string; label: string; note: string }) {
  // "7 of 9" -> big "7" + small "of 9"; "97–101 kPa" -> big "97–101" + small "kPa".
  const m = /^(\d+) (of \d+)$/.exec(value) ?? /^(.+) (kPa)$/.exec(value);
  return (
    <div className="card min-w-0 rounded-[28px] px-5 py-5">
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-fg">
        <DotNumber className="text-[36px] leading-[40px]">{m ? m[1] : value}</DotNumber>
        {m ? <span className="num text-[14px] text-muted">{m[2]}</span> : null}
      </div>
      <div className="mt-3 text-[14px] font-medium leading-5 text-fg">{label}</div>
      <div className="mt-1 text-xs leading-snug text-muted">{note}</div>
    </div>
  );
}

/** One calm limit row: a small amber dot, then the text. */
function Limit({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-3 border-t border-border py-3 first:border-t-0">
      <span aria-hidden className="mt-[9px] size-1.5 shrink-0 rounded-full bg-gap" />
      <span className="min-w-0">{children}</span>
    </li>
  );
}

/** Placeholder text block: wraps like the text it stands in for, so the section keeps its loaded height. */
function Ghost({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={`rounded-sm bg-subtle text-transparent [box-decoration-break:clone] motion-safe:animate-pulse ${className ?? ""}`}>{children}</span>;
}

/** Loading state with the loaded layout's structure (lead, tiles, limits, collapsed table), so later sections do not shift. */
function TrustSkeleton() {
  const tiles = [
    ["materials beat a simple guess", "Worse in none. 0 are acrylic spheres."],
    ["materials: uncertainty rises when wrong", "Unclear in 0. 0 of the 0 are acrylic spheres."],
    ["replays: ranking beat random picks", "Tied in 00, worse in 0."],
    ["recorded pressure in ISS tests", "Known for 000 of 000 results; the rest assumed."],
  ];
  return (
    <div role="status" aria-label="Loading the validation summary">
      <div aria-hidden className="space-y-6">
        <p className="max-w-[68ch] text-[16px] leading-relaxed">
          <Ghost>Short answer: partly. On ISS tests it had not seen, the model beats a simple guess in 00 of 00 materials. Where ISS tests give no evidence, it says so.</Ghost>
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {tiles.map(([label, note]) => (
            <div key={label} className="card min-w-0 rounded-[28px] px-5 py-5">
              <div className="text-[36px] leading-[40px]"><Ghost>00 of 00</Ghost></div>
              <div className="mt-3 text-[14px] font-medium leading-5"><Ghost>{label}</Ghost></div>
              <div className="mt-1 text-xs leading-snug"><Ghost>{note}</Ghost></div>
            </div>
          ))}
        </div>
        <div className="max-w-[78ch] space-y-2">
          <h3 className="text-[15px] font-semibold"><Ghost>Limits</Ghost></h3>
          <ul className="text-[14px] leading-relaxed">
            {[
              "The uncertainty check passes in only 0 of 0 materials, and leans on steps where airflow was switched off. Without them, at most 00 flame-went-out results remain per material.",
              "Gravity is not modelled. All ISS tests ran in free fall; the Moon and Mars differ. This site judges the air only.",
              "In 00 of 00 materials, its stated chances match reality worse than a constant guess.",
              "The ranking beats random picks in 00 of 00 replays, but not \"test the nearest gap\" (0 better, 00 tied, 0 worse).",
              "ISS tests ran near sea-level pressure, so no pressure effect is learned. Outside the tested range, the model gives no probability.",
            ].map((t) => (
              <Limit key={t}><Ghost>{t}</Ghost></Limit>
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
        Scored on ISS tests the model did not see. Details in section 4 below.
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
            return (
              <div className="space-y-6">
                <p className="max-w-[68ch] text-[16px] leading-relaxed" data-testid="trust-lead">
                  Short answer: partly. On ISS tests it had not seen, the model beats a simple guess in {better.length} of {gs.length} materials. Where ISS tests give no evidence, it says so.
                </p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <Tile
                    value={`${better.length} of ${gs.length}`}
                    label="materials beat a simple guess"
                    note={`${worse.length === 0 ? "Worse in none." : `Worse in ${worse.length}.`}${spheres(better) ? ` ${spheres(better)} are acrylic spheres.` : ""}`}
                  />
                  <Tile
                    value={`${bsSupported.length} of ${gs.length}`}
                    label="materials: uncertainty rises when wrong"
                    note={`Unclear in ${bsInconclusive.length}${gs.length - bsSupported.length - bsInconclusive.length ? `, not shown in ${gs.length - bsSupported.length - bsInconclusive.length}` : ""}.${spheres(bsSupported) ? ` ${spheres(bsSupported)} of the ${bsSupported.length} are acrylic spheres.` : ""}`}
                  />
                  {vr && summary ? (
                    <Tile
                      value={`${vr.better} of ${summary.n_scenarios}`}
                      label="replays: ranking beat random picks"
                      note={`Tied in ${vr.indistinguishable}, worse in ${vr.worse}.`}
                    />
                  ) : null}
                  {pr && nAssumed !== null && nSteps !== null ? (
                    <Tile
                      value={`${f(pr[0], 0)}–${f(pr[1], 0)} kPa`}
                      label="recorded pressure in ISS tests"
                      note={`Known for ${fmtCount(nSteps - nAssumed)} of ${fmtCount(nSteps)} results; the rest assumed at normal cabin pressure.`}
                    />
                  ) : null}
                </div>

                <div className="max-w-[78ch] space-y-2">
                  <h3 className="text-[15px] font-semibold">Limits</h3>
                  <ul className="text-[14px] leading-relaxed text-fg/90">
                    {bsSupported.length ? (
                      <Limit>
                        The uncertainty check passes in only {bsSupported.length} of {gs.length} materials
                        {leftVals.length ? `, and leans on steps where airflow was switched off. Without them, at most ${Math.max(...leftVals)} flame-went-out results remain per material.` : "."}
                      </Limit>
                    ) : null}
                    <Limit>
                      <strong className="font-medium">Gravity is not modelled.</strong> All ISS tests ran in free fall; the Moon and Mars differ. This site judges the air only.
                    </Limit>
                    <Limit>
                      In {eceWorse} of {gs.length} materials, its stated chances match reality worse than a constant guess.
                    </Limit>
                    {vg ? (
                      <Limit>
                        The ranking beats random picks in {vr?.better ?? "—"} of {summary?.n_scenarios ?? "—"} replays, but not &quot;test the nearest gap&quot; ({vg.better} better, {vg.indistinguishable} tied, {vg.worse} worse).
                      </Limit>
                    ) : null}
                    <Limit>
                      ISS tests ran near sea-level pressure, so no pressure effect is learned. Outside the tested range, the model gives no probability.
                    </Limit>
                  </ul>
                </div>

                <Disclosure summary="Results for each material" tone="strong" contentClassName="mt-3 pl-0" data-testid="trust-by-group">
                  <div className="relative overflow-x-auto rounded-[20px] border border-border bg-surface" tabIndex={0} role="region" aria-label="Validation summary by material">
                    <table className="w-full min-w-0 border-collapse sm:min-w-[720px] text-[13px]">
                      <caption className="sr-only">Checks on unseen tests, by material</caption>
                      <thead>
                        <tr className="border-b border-border bg-subtle text-left text-xs text-muted">
                          <th scope="col" className="px-3 py-2 font-medium">Material</th>
                          <th scope="col" className="px-3 py-2 text-right font-medium">Tests</th>
                          <th scope="col" className="px-3 py-2 font-medium">Versus a simple guess</th>
                          <th scope="col" className="px-3 py-2 font-medium">Uncertainty check</th>
                          <th scope="col" className="hidden px-3 py-2 text-right font-medium sm:table-cell">
                            Ranking vs random
                            <div className="font-normal">better / tied / worse</div>
                          </th>
                          <th scope="col" className="hidden px-3 py-2 sm:table-cell"><span className="sr-only">Details</span></th>
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
                              <th scope="row" className="w-[30%] px-3 py-2 text-left font-medium">
                                {label(g.group_id)}
                                <button
                                  type="button"
                                  onClick={() => onShowGroup(g.group_id)}
                                  className="mt-1 inline-flex min-h-10 items-center rounded-sm text-xs font-normal text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent sm:hidden"
                                >
                                  Details<span className="sr-only"> for {label(g.group_id)}</span>
                                </button>
                              </th>
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
                              <td className="num hidden whitespace-nowrap px-3 py-2 text-right sm:table-cell">
                                {rr.n ? (
                                  <span aria-label={`${rr.better} better, ${rr.same} tied, ${rr.worse} worse`}>
                                    {rr.better} / {rr.same} / {rr.worse}
                                  </span>
                                ) : (
                                  <span className="text-muted">no replay</span>
                                )}
                              </td>
                              <td className="hidden px-3 py-1.5 text-right sm:table-cell">
                                <button
                                  type="button"
                                  onClick={() => onShowGroup(g.group_id)}
                                  className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-sm px-1.5 text-xs text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent"
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
                    Numbers under each verdict: model score, then simple-guess score (log loss, lower is better), on unseen tests. &quot;Better&quot; means clearly better, not chance (95 % interval).
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
