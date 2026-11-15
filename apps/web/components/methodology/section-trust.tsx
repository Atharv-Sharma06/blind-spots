"use client";

import type { ReactNode } from "react";
import type { ApiQuery } from "@/hooks/api";
import type { GroupSummary } from "@/lib/types";
import { fmtCount } from "@/lib/format";
import type { ExtGroupValidation, ExtValidation } from "./types";
import { blindspotShortfall, VERDICT_WORD } from "./labels";
import { QueryBoundary } from "./primitives";

const f = (v: number | null | undefined, d = 2): string => (typeof v === "number" && Number.isFinite(v) ? v.toFixed(d) : "—");

type Vs = "better" | "worse" | "same" | "unknown";
function vsMajority(g: ExtGroupValidation): Vs {
  const c = g.cv.gp_vs_majority?.log_loss?.ci95;
  if (!c) return "unknown";
  if (c[1] < 0) return "better";
  if (c[0] > 0) return "worse";
  return "same";
}
const model = (g: ExtGroupValidation, id: string) => g.cv.models.find((m) => m.name === id);

function retroVsRandom(v: ExtValidation, gid: string) {
  const out = { better: 0, same: 0, worse: 0, n: 0 };
  for (const s of v.acquisition_retrospective.scenarios) {
    if (s.group_id !== gid) continue;
    const c = s.paired_differences?.evr_minus_random?.ci95;
    if (!c) continue;
    out.n += 1;
    if (c[1] < 0) out.better += 1;
    else if (c[0] > 0) out.worse += 1;
    else out.same += 1;
  }
  return out;
}

type RetroCounts = { better: number; indistinguishable: number; worse: number };

function Tile({ value, label, note }: { value: string; label: string; note: string }) {
  return (
    <div className="min-w-0 rounded-md border border-border bg-surface px-4 py-3">
      <div className="num text-[22px] font-medium leading-tight tracking-[-0.01em] text-fg">{value}</div>
      <div className="mt-1 text-[13px] font-medium text-fg">{label}</div>
      <div className="mt-0.5 text-xs leading-snug text-muted">{note}</div>
    </div>
  );
}

/** Placeholder text block: wraps like the text it stands in for, so the section keeps its loaded height. */
function Ghost({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={`rounded-sm bg-subtle text-transparent [box-decoration-break:clone] motion-safe:animate-pulse ${className ?? ""}`}>{children}</span>;
}

/** Loading state with the loaded layout's structure (tiles, group table, limits), so later sections do not shift. */
function TrustSkeleton({ groups }: { groups: GroupSummary[] | undefined }) {
  const rows = groups?.length ? groups.map((g) => g.label) : Array.from({ length: 20 }, () => "Material · flame configuration");
  const tiles = [
    ["groups where the model beats a simple guess", "Log-loss 95 % interval below a majority-class guess. Clearly worse in none."],
    ["groups where its uncertainty flags its own errors", "Blind-spot test supported; inconclusive in 00, not supported in 00."],
    ["replays where target-aware ranking beat random", "Tied in 00, worse in 0; against the nearest-gap rule 0 better, 0 worse."],
    ["pressure range of all integrated data", "About 1 atm. At lower cabin pressures the model has no evidence and says so."],
  ];
  return (
    <div role="status" aria-label="Loading the validation summary">
      <div aria-hidden className="space-y-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {tiles.map(([label, note]) => (
            <div key={label} className="min-w-0 rounded-md border border-border bg-surface px-4 py-3">
              <div className="num text-[22px] font-medium leading-tight tracking-[-0.01em]"><Ghost>00 of 00</Ghost></div>
              <div className="mt-1 text-[13px] font-medium"><Ghost>{label}</Ghost></div>
              <div className="mt-0.5 text-xs leading-snug"><Ghost>{note}</Ghost></div>
            </div>
          ))}
        </div>
        <div>
          <h3 className="mb-2 text-[14px] font-semibold"><Ghost>Group by group</Ghost></h3>
          <div className="relative overflow-x-hidden rounded-md border border-border bg-surface">
            <table className="w-full min-w-[720px] border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-border bg-subtle text-left text-xs">
                  <th className="px-3 py-2 font-medium"><Ghost>Material and flame configuration</Ghost></th>
                  <th className="px-3 py-2 font-medium"><Ghost>Tests</Ghost></th>
                  <th className="px-3 py-2 font-medium"><Ghost>Versus a majority-class guess (log loss)</Ghost></th>
                  <th className="px-3 py-2 font-medium"><Ghost>Blind-spot test</Ghost></th>
                  <th className="px-3 py-2 text-right font-medium"><Ghost>Ranking vs random</Ghost><div className="font-normal"><Ghost>better / tied / worse</Ghost></div></th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((label, i) => (
                  <tr key={i} className="border-b border-border align-top last:border-b-0">
                    <th className="w-[30%] px-3 py-2 text-left font-medium"><Ghost>{label}</Ghost></th>
                    <td className="num px-3 py-2 text-right"><Ghost>00</Ghost></td>
                    <td className="px-3 py-2"><Ghost>No clear difference</Ghost><div className="num whitespace-nowrap text-xs"><Ghost>0.000 vs 0.000</Ghost></div></td>
                    <td className="px-3 py-2"><Ghost>Inconclusive</Ghost></td>
                    <td className="num whitespace-nowrap px-3 py-2 text-right"><Ghost>0 / 0 / 0</Ghost></td>
                    <td className="px-3 py-1.5 text-right"><span className="inline-flex min-h-7 items-center px-1.5 text-xs"><Ghost>Details</Ghost></span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 max-w-[78ch] text-xs leading-relaxed">
            <Ghost>
              Log loss: lower is better (out-of-fold, grouped by experiment, 95 % group-bootstrap intervals). &quot;Better&quot; means the whole interval of the difference lies below 0. Ranking vs random: replays on held-out real experiments in which each strategy picks tests one at a time (section 4).
            </Ghost>
          </p>
        </div>
        <div className="max-w-[78ch] space-y-2">
          <h3 className="text-[14px] font-semibold"><Ghost>Read the results with these limits</Ghost></h3>
          <ul className="space-y-1.5 pl-5 text-[14px] leading-relaxed">
            {[
              "The blind-spot test passes only in a few material groups and flame configurations. There the model misclassified only a few points, and without the flow-turned-off steps a few not-sustained observations remain. Treat it as unproven for physical extinction boundaries.",
              "Uncertainty is reported, not recalibrated: the model is uncertainty-aware, not certified as calibrated. Its expected calibration error is higher than that of a constant guess in 00 of 00 groups (section 4).",
              "The ranking's advantage is modest: it beat random in 00 of 00 replays and has no reliable edge over simply testing the nearest gap (0 better, 00 tied, 0 worse). The replays share groups, so they are not independent.",
              "Every integrated observation is near 1 atm, so no pressure effect is learned. At other pressures, and beyond the tested oxygen range, the model reverts toward the group's base rate; the support verdict (section 2) withholds the probability there.",
            ].map((t) => (
              <li key={t}><Ghost>{t}</Ghost></li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/** "Can you trust it?": a plain-language summary computed from GET /api/model/validation and /api/groups. */
export function TrustSection({
  validation,
  groups,
  onShowGroup,
}: {
  validation: ApiQuery<ExtValidation>;
  groups: GroupSummary[] | undefined;
  onShowGroup: (groupId: string) => void;
}) {
  const label = (id: string) => groups?.find((g) => g.group_id === id)?.label ?? id;
  return (
    <section id="trust" aria-labelledby="trust-h" className="scroll-mt-[calc(var(--header-h)+16px)]">
      <h2 id="trust-h" className="text-[20px] font-semibold tracking-[-0.015em]">
        Can you trust it?
      </h2>
      <p className="mt-2 max-w-[68ch] text-[14px] leading-relaxed text-muted">
        The short answer, computed from the out-of-sample checks in section 4. Every test is grouped by experiment, so the model is always scored on tests it did not see.
      </p>
      <div className="mt-5">
        {validation.isPending ? <TrustSkeleton groups={groups} /> : (
        <QueryBoundary query={validation} rows={4}>
          {(v) => {
            const gs = v.groups;
            if (gs.length === 0) return <p className="text-[14px] text-muted">No validation results are available.</p>;
            const better = gs.filter((g) => vsMajority(g) === "better");
            const worse = gs.filter((g) => vsMajority(g) === "worse");
            const bsSupported = gs.filter((g) => g.blindspot_test.verdict === "supported");
            const bsInconclusive = gs.filter((g) => g.blindspot_test.verdict === "inconclusive");
            const summary = (v.acquisition_retrospective as { summary?: { n_scenarios: number; evr_vs_random?: RetroCounts; evr_vs_nearest_gap?: RetroCounts } }).summary;
            const vr = summary?.evr_vs_random;
            const vg = summary?.evr_vs_nearest_gap;
            const eceWorse = gs.filter((g) => {
                const a = model(g, "gp")?.ece.value;
                const b = model(g, "majority_class")?.ece.value;
                return typeof a === "number" && typeof b === "number" && a > b;
              }).length;
            const ranges = (groups ?? []).flatMap((g) => g.pressure_kpa_range ?? []).filter((x): x is number => typeof x === "number");
            const pLo = ranges.length ? Math.min(...ranges) : null;
            const pHi = ranges.length ? Math.max(...ranges) : null;
            const supportedFacts = bsSupported.map((g) => {
              const fo = g.sensitivity.find((s) => /flow_off/i.test(s.variant));
              return { mis: g.blindspot_test.point_level.n_misclassified, left: fo?.n_not_sustained };
            });
            const misVals = supportedFacts.map((x) => x.mis).filter((x): x is number => typeof x === "number");
            const leftVals = supportedFacts.map((x) => x.left).filter((x): x is number => typeof x === "number");
            const span = (xs: number[]) => (xs.length ? (Math.min(...xs) === Math.max(...xs) ? `${Math.min(...xs)}` : `${Math.min(...xs)}–${Math.max(...xs)}`) : null);
            return (
              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <Tile
                    value={`${better.length} of ${gs.length}`}
                    label="groups where the model beats a simple guess"
                    note={`Log-loss 95 % interval below a majority-class guess. ${worse.length === 0 ? "Clearly worse in none." : `Clearly worse in ${worse.length}.`}`}
                  />
                  <Tile
                    value={`${bsSupported.length} of ${gs.length}`}
                    label="groups where its uncertainty flags its own errors"
                    note={`Blind-spot test supported; inconclusive in ${bsInconclusive.length}${gs.length - bsSupported.length - bsInconclusive.length ? `, not supported in ${gs.length - bsSupported.length - bsInconclusive.length}` : ""}.`}
                  />
                  {vr && summary ? (
                    <Tile
                      value={`${vr.better} of ${summary.n_scenarios}`}
                      label="replays where target-aware ranking beat random"
                      note={`Tied in ${vr.indistinguishable}, worse in ${vr.worse}${vg ? `; against the nearest-gap rule ${vg.better} better, ${vg.worse} worse` : ""}.`}
                    />
                  ) : null}
                  {pLo !== null && pHi !== null ? (
                    <Tile value={`${f(pLo, 0)}–${f(pHi, 0)} kPa`} label="pressure range of all integrated data" note="About 1 atm. At lower cabin pressures the model has no evidence and says so." />
                  ) : null}
                </div>

                <div>
                  <h3 className="mb-2 text-[14px] font-semibold">Group by group</h3>
                  <div className="relative overflow-x-auto rounded-md border border-border bg-surface" tabIndex={0} role="region" aria-label="Validation summary by analysis group">
                    <table className="w-full min-w-[720px] border-collapse text-[13px]">
                      <caption className="sr-only">Out-of-sample checks by analysis group</caption>
                      <thead>
                        <tr className="border-b border-border bg-subtle text-left text-xs text-muted">
                          <th scope="col" className="px-3 py-2 font-medium">Material and flame configuration</th>
                          <th scope="col" className="px-3 py-2 text-right font-medium">Tests</th>
                          <th scope="col" className="px-3 py-2 font-medium">Versus a majority-class guess (log loss)</th>
                          <th scope="col" className="px-3 py-2 font-medium">Blind-spot test</th>
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
                                  {vs === "better" ? "Better" : vs === "worse" ? "Worse" : vs === "same" ? "No clear difference" : "Not evaluated"}
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
                    Log loss: lower is better (out-of-fold, grouped by experiment, 95 % group-bootstrap intervals). &quot;Better&quot; means the whole interval of the difference lies below 0. Ranking vs random: replays on held-out real experiments in which each
                    strategy picks tests one at a time (section 4).
                  </p>
                </div>

                <div className="max-w-[78ch] space-y-2">
                  <h3 className="text-[14px] font-semibold">Read the results with these limits</h3>
                  <ul className="list-disc space-y-1.5 pl-5 text-[14px] leading-relaxed marker:text-muted">
                    {bsSupported.length ? (
                      <li>
                        The blind-spot test passes only in {bsSupported.map((g) => label(g.group_id)).join("; ")}.
                        {span(misVals) !== null ? ` There the model misclassified only ${span(misVals)} points` : ""}
                        {span(leftVals) !== null ? `, and without the flow-turned-off steps ${span(leftVals)} not-sustained observations remain` : ""}. Treat it as unproven for physical extinction boundaries.
                      </li>
                    ) : null}
                    <li>
                      Uncertainty is reported, not recalibrated: the model is uncertainty-aware, not certified as calibrated. Its expected calibration error is higher than that of a constant guess in {eceWorse} of {gs.length} groups (section 4).
                    </li>
                    {vg ? (
                      <li>
                        The ranking&apos;s advantage is modest: it beat random in {vr?.better ?? "—"} of {summary?.n_scenarios ?? "—"} replays and has no reliable edge over simply testing the nearest gap ({vg.better} better, {vg.indistinguishable} tied, {vg.worse} worse). The replays share groups, so they are not independent.
                      </li>
                    ) : null}
                    <li>
                      Every integrated observation is near 1 atm, so no pressure effect is learned. At other pressures, and beyond the tested oxygen range, the model reverts toward the group&apos;s base rate; the support verdict (section 2) withholds the probability there.
                    </li>
                  </ul>
                </div>
              </div>
            );
          }}
        </QueryBoundary>
        )}
      </div>
    </section>
  );
}
