"use client";

import { useMemo } from "react";
import { useGroups, useValidation } from "@/hooks/api";
import { ProvenanceTag } from "@/components/ui/provenance-tag";
import { CANDIDATE_FRAMING } from "@/lib/copy";
import { cn } from "@/lib/cn";
import type { GroupSummary } from "@/lib/types";
import {
  RULE_TEXT,
  fmtBrier,
  fmtCi,
  guessLabel,
  modelChecks,
  notClearlyCount,
  verdictWords,
  type CheckVerdict,
  type ModelCheckRow,
  type ValidationGroupLike,
} from "./model-check-data";

/** The SI line (product plan F5): the ML model does the work; an optional Claude explainer is labelled. */
export const SI_LINE =
  "SI here means an uncertainty-aware ML model (Gaussian process) that estimates, abstains and ranks, built with SI assistance. Findings and answers are written by code; the optional Claude explanation is labelled SI-generated.";

function useModelCheckRows(): { rows: ModelCheckRow[]; groups: GroupSummary[]; pending: boolean; failed: boolean } {
  const validation = useValidation();
  const groupsQ = useGroups();
  const raw = validation.data?.data.groups as unknown as ValidationGroupLike[] | undefined;
  const rows = useMemo(() => modelChecks(raw), [raw]);
  return { rows, groups: groupsQ.data?.data ?? [], pending: validation.isPending, failed: validation.isError };
}

function VerdictDot({ v }: { v: CheckVerdict }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block size-2.5 shrink-0 rounded-full",
        v === "clearly_better" ? "bg-[var(--accent)]" : v === "not_clearly_better" ? "bg-[var(--gap)]" : "border border-border-strong",
      )}
    />
  );
}

/** Same resolution as the Cabins answer card: the chosen material if modelled, else the API default, else the first modelled. */
function resolveGroup(groups: GroupSummary[], groupId: string | null, modelledOnly: boolean): GroupSummary | null {
  const modelled = groups.filter((g) => g.model_status === "modeled");
  const picked = (modelledOnly ? modelled : groups).find((g) => g.group_id === groupId) ?? null;
  return picked ?? modelled.find((g) => g.is_default) ?? modelled[0] ?? null;
}

/**
 * Compact "Model check" for one material: model error vs always guessing the usual outcome (cross-validated Brier).
 * variant "card" = its own bordered card (Cabins); "inline" = a strip inside another card (Explorer map card).
 */
export function ModelCheckCompact({ groupId, variant = "card", className }: { groupId: string | null; variant?: "card" | "inline"; className?: string }) {
  const { rows, groups, pending, failed } = useModelCheckRows();
  // Cabins mirrors its answer card (falls back to a modelled material); the Explorer shows the material as picked.
  const group = resolveGroup(groups, groupId, variant === "card");
  const row = group ? rows.find((r) => r.groupId === group.group_id) ?? null : null;
  const wrap = cn(variant === "card" ? "card p-5 sm:p-7" : "border-t border-border px-5 py-4 sm:px-6", className);

  if (pending || !group) {
    return failed ? null : <div className={wrap} aria-busy="true" data-testid="model-check" />;
  }
  if (failed) return null;

  const title = (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
      <h3 className="eyebrow text-muted">Model check</h3>
      <a href="/methodology#model-check" className="inline-flex min-h-10 items-center rounded-sm text-[13px] text-accent underline underline-offset-2 hover:decoration-2 focus-visible:outline-2 focus-visible:outline-accent">
        All materials
      </a>
    </div>
  );

  if (!row) {
    // No validation entry: the model abstains on this material (insufficient data). Say why, from groups.model_reason.
    return (
      <section className={wrap} data-testid="model-check" data-verdict="none" aria-label="Model check">
        {title}
        <p className="mt-2 text-[14px] leading-5">No model check for this material: the model gives no estimate here.</p>
        <p className="mt-1 text-[13px] leading-5 text-muted">Reason: {group.model_reason ?? "too few ISS tests"}.</p>
      </section>
    );
  }

  const notClearly = row.vsGuess === "not_clearly_better";
  return (
    <section className={wrap} data-testid="model-check" data-verdict={row.vsGuess} aria-label="Model check">
      {title}
      <div className="mt-3 grid grid-cols-2 gap-4">
        <div className="min-w-0">
          <p className="num text-[28px] font-medium leading-8 tracking-[-0.02em] sm:text-[32px] sm:leading-9">{fmtBrier(row.gpBrier)}</p>
          <p className="mt-1 text-[13px] leading-4 text-muted">Model error</p>
          <p className="mt-0.5 text-[12px] leading-4 text-muted">95% range {fmtCi(row.gpCi)}</p>
        </div>
        <div className="min-w-0">
          <p className="num text-[28px] font-medium leading-8 tracking-[-0.02em] text-muted sm:text-[32px] sm:leading-9">{fmtBrier(row.majorityBrier)}</p>
          <p className="mt-1 text-[13px] leading-4 text-muted">{guessLabel(row)}</p>
        </div>
      </div>
      <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted">
        Error is the Brier score: lower is better. <ProvenanceTag kind="derived" title="GET /api/model/validation" />
      </p>
      <p className="mt-3 flex items-center gap-2 text-[15px] font-medium leading-5" data-testid="model-check-verdict">
        <VerdictDot v={row.vsGuess} />
        {verdictWords(row.vsGuess, "guess")}
      </p>
      {notClearly ? (
        <p className="mt-1 text-[14px] leading-5">On this material the model is not clearly better than a simple guess, so treat its map as a rough guide.</p>
      ) : null}
      <p className="mt-2 text-[13px] leading-5 text-muted">
        Cross-validated on {row.nExperiments} ISS experiments, held out by experiment. {verdictWords(row.vsCurve, "curve")}.
      </p>
      <p className="mt-1 text-[13px] leading-5 text-muted">
        Separate from this check, the model gives no estimate when a material has too few ISS tests or no comparable tests are near the chosen air.
      </p>
    </section>
  );
}

/** /methodology: every validated material, verdict words + numbers + intervals, plus "Good at / Cannot tell / Always true". */
export function ModelCheckFull() {
  const { rows, groups, pending, failed } = useModelCheckRows();
  const { k, n } = notClearlyCount(rows);
  const curveBetter = rows.filter((r) => r.vsCurve === "clearly_better").length;
  const abstaining = groups.filter((g) => g.model_status !== "modeled").length;
  const labelOf = (r: ModelCheckRow) => groups.find((g) => g.group_id === r.groupId)?.label ?? r.label ?? r.groupId;

  return (
    <section id="model-check" aria-labelledby="model-check-h" className="card scroll-mt-[calc(var(--header-h)+16px)] p-5 sm:p-8" data-testid="model-check-full">
      <p className="eyebrow text-muted">Model check</p>
      <h2 id="model-check-h" className="mt-1 text-[24px] font-medium leading-[30px] tracking-[-0.02em] sm:text-[28px] sm:leading-[34px]">
        Is the model better than a simple guess?
      </h2>
      <p className="mt-2 max-w-[70ch] text-[15px] leading-6 text-muted">
        For each material we compare the model&apos;s error with always guessing the usual outcome and with a simple oxygen-and-airflow curve. Error is the cross-validated Brier score (lower is better),
        with whole experiments held out. {RULE_TEXT}
      </p>

      {pending ? (
        <p role="status" className="mt-5 text-[14px] text-muted">
          Loading the model check&hellip;
        </p>
      ) : failed ? (
        <p className="mt-5 text-[14px] text-muted">The model check could not be loaded.</p>
      ) : (
        <>
          <p className="mt-5 text-[16px] font-medium leading-6" data-testid="model-check-summary">
            On {k} of {n} materials the model is not clearly better than always guessing the usual outcome. It is clearly better than the simple curve on {curveBetter} of {n}.
          </p>
          <ul className="mt-4 divide-y divide-border rounded-[var(--radius-lg)] border border-border sm:hidden" aria-label="Model check per material">
            {rows.map((r) => (
              <li key={r.groupId} className="px-4 py-3" data-group={r.groupId} data-verdict={r.vsGuess}>
                <p className="text-[15px] font-medium leading-5">{labelOf(r)}</p>
                <p className="mt-1 flex items-center gap-2 text-[14px]">
                  <VerdictDot v={r.vsGuess} />
                  {r.vsGuess === "clearly_better" ? "Clearly better" : r.vsGuess === "not_clearly_better" ? "Not clearly better" : "No check"}
                </p>
                <p className="mt-1 text-[13px] leading-5 text-muted">
                  Model error <span className="num text-fg">{fmtBrier(r.gpBrier)}</span> ({fmtCi(r.gpCi)}) vs guess <span className="num text-fg">{fmtBrier(r.majorityBrier)}</span>, curve{" "}
                  <span className="num text-fg">{fmtBrier(r.curveBrier)}</span>. {r.nExperiments} experiments.
                </p>
              </li>
            ))}
          </ul>
          <div className="mt-4 hidden overflow-x-auto rounded-[var(--radius-lg)] border border-border sm:block">
            <table className="w-full min-w-[640px] border-collapse text-left text-[14px]">
              <caption className="sr-only">Model error compared with two simple methods, per material</caption>
              <thead>
                <tr className="border-b border-border bg-subtle text-[12px] text-muted">
                  <th scope="col" className="px-3 py-2.5 font-medium">Material</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Versus always guessing</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">Model error (95% range)</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">Guess error</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">Curve error</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">Experiments</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.groupId} className="border-b border-border last:border-b-0" data-group={r.groupId} data-verdict={r.vsGuess}>
                    <th scope="row" className="px-3 py-2.5 font-medium">{labelOf(r)}</th>
                    <td className="px-3 py-2.5">
                      <span className="inline-flex items-center gap-2">
                        <VerdictDot v={r.vsGuess} />
                        {r.vsGuess === "clearly_better" ? "Clearly better" : r.vsGuess === "not_clearly_better" ? "Not clearly better" : "No check"}
                      </span>
                      <span className="block text-[12px] text-muted">vs curve: {r.vsCurve === "clearly_better" ? "clearly better" : r.vsCurve === "not_clearly_better" ? "not clearly better" : "no check"}</span>
                    </td>
                    <td className="num px-3 py-2.5 text-right">
                      {fmtBrier(r.gpBrier)} <span className="block text-[12px] text-muted">{fmtCi(r.gpCi)}</span>
                    </td>
                    <td className="num px-3 py-2.5 text-right">
                      {fmtBrier(r.majorityBrier)}
                      <span className="block text-[12px] text-muted">{r.majorityLabel ? `always “${r.majorityLabel}”` : ""}</span>
                    </td>
                    <td className="num px-3 py-2.5 text-right">{fmtBrier(r.curveBrier)}</td>
                    <td className="num px-3 py-2.5 text-right">{r.nExperiments}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[13px] leading-5 text-muted">
            {rows.length > 0 && rows.every((r) => r.smallSample) ? "Every material here is a small sample, so the ranges are wide. " : "Small samples give wide ranges. "}{abstaining > 0 ? `${abstaining} more materials have too few ISS tests, so the model gives no estimate for them and they are not checked here. ` : ""}
            This check does not decide when the model abstains.
          </p>
        </>
      )}

      <div className="mt-8 grid gap-4 md:grid-cols-3" data-testid="capability-panel">
        <div className="rounded-[var(--radius-lg)] border border-border p-5">
          <h3 className="text-[18px] font-medium">Good at</h3>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[14px] leading-5">
            <li>Showing which cabin air has nearby ISS test results and which has none.</li>
            <li>Saying &ldquo;no estimate&rdquo; when a material has too few tests, instead of guessing.</li>
            <li>Ranking computational research candidates by how much they would narrow the uncertainty for a chosen cabin.</li>
          </ul>
        </div>
        <div className="rounded-[var(--radius-lg)] border border-border p-5">
          <h3 className="text-[18px] font-medium">Cannot tell</h3>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[14px] leading-5">
            <li>Moon or Mars gravity: every test was in microgravity on the ISS.</li>
            <li>Real cabin ventilation: the model only knows the airflow used in each test.</li>
            <li>Exact pressure for many tests: it was often not recorded and is assumed.</li>
            {!pending && !failed && n > 0 ? <li>Whether the model beats a simple guess on {k} of {n} materials (see the table).</li> : null}
          </ul>
        </div>
        <div className="rounded-[var(--radius-lg)] border border-border p-5">
          <h3 className="text-[18px] font-medium">Always true</h3>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[14px] leading-5">
            <li>ISS tests only.</li>
            <li>Not a certified fire-safety assessment. Not endorsed by NASA.</li>
            <li>{CANDIDATE_FRAMING}</li>
          </ul>
        </div>
      </div>
      <p className="mt-5 max-w-[78ch] text-[14px] leading-6" data-testid="si-line">
        {SI_LINE}
      </p>
    </section>
  );
}
