"use client";

import { useId, useMemo, useState } from "react";
import { ProvenanceTag } from "@/components/ui/provenance-tag";
import { isSnapshotUnavailable, unavailableCopy } from "@/lib/api";
import { cn } from "@/lib/cn";
import type { AssessRequest } from "@/lib/types";
import {
  CLOSING_LINE,
  burnedAnswer,
  fmt,
  gapBullets,
  modelSentence,
  nearestSentence,
  nearestTest,
  testedRanges,
  type AskObservation,
} from "./answer";
import { useAskData } from "./use-ask-data";

type Question = "burned" | "nearest" | "model";
const QUESTIONS: { id: Question; label: string }[] = [
  { id: "burned", label: "Has a flame burned in air like this?" },
  { id: "nearest", label: "What is the closest ISS test?" },
  { id: "model", label: "Can the model answer here?" },
];
const CUSTOM = "__custom__";
const PREFERRED_CABIN = "artemis_surface_habitat_10p2_26p5";

const chip =
  "inline-flex min-h-10 items-center rounded-full border px-4 text-[14px] leading-5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]";
const selectCls =
  "mt-1 block min-h-11 w-full rounded-[12px] border border-border-strong bg-surface px-3 text-[16px] text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]";
const chipOn = "border-fg bg-fg text-[var(--surface)]";
const chipOff = "border-border-strong bg-surface text-fg hover:bg-subtle";

/** "Ask about your cabin air": templated answers filled from ISS test records and precomputed model results. */
export function AskCabinAir({ id }: { id?: string }) {
  const uid = useId();
  const [groupPick, setGroupPick] = useState<string | null>(null);
  const [cabinPick, setCabinPick] = useState<string | null>(null);
  const [question, setQuestion] = useState<Question>("burned");
  const [customO2, setCustomO2] = useState<number | null>(null);
  const [customKpa, setCustomKpa] = useState<number | null>(null);

  // Groups and targets load first; the observation/assess requests depend on the chosen group and air.
  const pre = useAskData(null, null);
  const groupList = pre.groupList;
  const defaultGroup =
    groupList.find((g) => g.is_default)?.group_id ?? groupList.find((g) => g.model_status === "modeled")?.group_id ?? null;
  const groupId = groupPick ?? defaultGroup;
  const group = groupList.find((g) => g.group_id === groupId) ?? null;
  const cabins = pre.cabins;
  const defaultCabin = cabins.find((c) => c.profile_id === PREFERRED_CABIN)?.profile_id ?? cabins[0]?.profile_id ?? null;
  const cabinId = cabinPick ?? defaultCabin;
  const isCustom = cabinId === CUSTOM;
  const cabin = isCustom ? null : (cabins.find((c) => c.profile_id === cabinId) ?? null);

  const o2 = isCustom ? customO2 : (cabin?.oxygen_percent.nominal ?? null);
  const kpa = isCustom ? customKpa : (cabin?.total_pressure_kpa.nominal ?? null);
  const chooseCustom = () => {
    // Custom air starts from the air currently shown (a documented cabin), never from an invented value.
    if (!isCustom && cabin) {
      setCustomO2(cabin.oxygen_percent.nominal);
      setCustomKpa(cabin.total_pressure_kpa.nominal);
    }
    setCabinPick(CUSTOM);
  };

  const assessBody: AssessRequest | null = useMemo(() => {
    if (!groupId) return null;
    if (!isCustom && cabinId) return { group_id: groupId, target: { profile_id: cabinId } };
    if (isCustom && question === "model" && customO2 != null && customKpa != null) {
      return {
        group_id: groupId,
        target: {
          custom: {
            label: "User-selected hypothetical conditions",
            oxygen_percent: { nominal: customO2, min: null, max: null },
            total_pressure_kpa: { nominal: customKpa, min: null, max: null },
            airflow_cm_s: null,
          },
        },
      };
    }
    return null;
  }, [groupId, cabinId, isCustom, question, customO2, customKpa]);

  const data = useAskData(groupId, assessBody);
  const obs = useMemo(() => (data.observations.data?.data ?? []) as AskObservation[], [data.observations.data]);

  // Slider ranges from data: oxygen = min..max over observations and documented cabins; pressure = documented cabins.
  const o2Range = useMemo(() => {
    const vals = [
      ...obs.map((o) => o.oxygen_percent).filter((v): v is number => v != null),
      ...cabins.map((c) => c.oxygen_percent.nominal).filter((v): v is number => v != null),
    ];
    return vals.length ? ([Math.floor(Math.min(...vals)), Math.ceil(Math.max(...vals))] as const) : null;
  }, [obs, cabins]);
  const kpaRange = useMemo(() => {
    const vals = cabins.map((c) => c.total_pressure_kpa.nominal).filter((v): v is number => v != null);
    return vals.length ? ([Math.min(...vals), Math.max(...vals)] as const) : null;
  }, [cabins]);

  const label = group?.label ?? "this material";
  const firstError = pre.targets.error ?? pre.groups.error ?? data.observations.error;
  const loading = pre.targets.isPending || pre.groups.isPending || (groupId != null && data.observations.isPending);

  let body: React.ReactNode = null;
  if (firstError) {
    const copy = unavailableCopy(firstError);
    body = <p className="text-[16px] leading-6 text-muted">{copy?.description ?? "The ISS test records could not be loaded."}</p>;
  } else if (loading || !groupId || o2 == null || kpa == null) {
    body = <p className="text-[16px] leading-6 text-muted">Loading ISS test records…</p>;
  } else {
    const ranges = testedRanges(obs, groupId);
    const gaps = gapBullets(ranges, o2, kpa);
    if (question === "burned") {
      const a = burnedAnswer(obs, groupId, label, o2, kpa);
      body = (
        <Answer
          sentence={a.sentence}
          how={
            <>
              <ProvenanceTag kind="measured" title={`${a.n} ISS test results counted`} /> counted from ISS test results of this
              material at or below {fmt(o2)} % oxygen.
              {ranges.all_pressure_assumed ? (
                <>
                  {" "}
                  <ProvenanceTag kind="assumed" /> pressure was not recorded; sea-level pressure is assumed.
                </>
              ) : null}
            </>
          }
          gaps={gaps}
        />
      );
    } else if (question === "nearest") {
      const t = nearestTest(obs, groupId, o2, kpa);
      body = (
        <Answer
          sentence={nearestSentence(t, label)}
          how={
            t ? (
              <>
                <ProvenanceTag kind="measured" title={t.observation_id} /> oxygen and outcome as recorded;{" "}
                <ProvenanceTag kind={t.pressure_basis} /> pressure;{" "}
                <ProvenanceTag kind={t.airflow_cm_s == null ? "missing" : "measured"} /> airflow;{" "}
                <ProvenanceTag kind="derived" /> closest by oxygen and pressure in the documented reference units (2 %
                oxygen, 10 % in pressure). Airflow is not compared.
              </>
            ) : null
          }
          gaps={gaps}
        />
      );
    } else {
      const aq = data.assessQ;
      if (isCustom && aq.error && isSnapshotUnavailable(aq.error)) {
        body = (
          <Answer
            sentence="A model estimate for custom air needs the live analysis service."
            how={<>This page is running from a precomputed snapshot that holds model results for the documented cabins only.</>}
            gaps={gaps}
          />
        );
      } else if (aq.error) {
        const copy = unavailableCopy(aq.error);
        body = <p className="text-[16px] leading-6 text-muted">{copy?.description ?? "The model result could not be loaded."}</p>;
      } else if (aq.isPending || !aq.data) {
        body = <p className="text-[16px] leading-6 text-muted">Loading the model result…</p>;
      } else {
        const r = aq.data.data;
        const m = modelSentence({
          model_status: r.model.model_status ?? group?.model_status ?? null,
          model_reason: group?.model_reason ?? null,
          verdict: r.verdict,
          p_mean: r.model.p_sustained_mean,
          p_min: r.model.p_sustained_min,
          p_max: r.model.p_sustained_max,
          points_supported: r.points_supported ?? null,
          n_points: r.coverage.n_target_points ?? null,
        });
        body = (
          <Answer
            sentence={m.sentence}
            how={
              <>
                <ProvenanceTag kind="model" /> from the analysis service&apos;s result for this material and air;{" "}
                <ProvenanceTag kind="measured" /> {r.coverage.comparable_observations} comparable ISS test results nearby.
              </>
            }
            gaps={m.abstains ? gaps : []}
          />
        );
      }
    }
  }

  return (
    <section id={id} aria-labelledby={`${uid}-title`} className="card scroll-mt-24 p-5 sm:p-7">
      <p className="eyebrow text-muted">Ask</p>
      <h2 id={`${uid}-title`} className="mt-1 text-[22px] font-semibold leading-7 tracking-[-0.01em] text-fg sm:text-[28px] sm:leading-[34px]">
        Ask about your cabin air
      </h2>
      <p className="mt-2 max-w-[60ch] text-[16px] leading-6 text-muted">
        Pick a material and an air. Each answer is filled in by code from ISS test records.
      </p>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="min-w-0 space-y-4">
          <div>
            <label htmlFor={`${uid}-group`} className="eyebrow text-muted">
              Material
            </label>
            <select
              id={`${uid}-group`}
              value={groupId ?? ""}
              onChange={(e) => setGroupPick(e.target.value)}
              className={selectCls}
            >
              {groupList.map((g) => (
                <option key={g.group_id} value={g.group_id}>
                  {g.label}
                  {g.model_status === "modeled" ? "" : " (model abstains)"}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor={`${uid}-air`} className="eyebrow text-muted">
              Cabin air
            </label>
            <select
              id={`${uid}-air`}
              value={cabinId ?? ""}
              onChange={(e) => (e.target.value === CUSTOM ? chooseCustom() : setCabinPick(e.target.value))}
              className={selectCls}
            >
              {cabins.map((c) => (
                <option key={c.profile_id} value={c.profile_id}>
                  {c.name}
                </option>
              ))}
              <option value={CUSTOM}>Custom air (set oxygen and pressure)</option>
            </select>
            {!isCustom && cabin ? (
              <p className="mt-2 text-[14px] leading-5 text-muted">
                <span className="num text-fg">{fmt(cabin.oxygen_percent.nominal as number)} %</span> oxygen ·{" "}
                <span className="num text-fg">{fmt(cabin.total_pressure_kpa.nominal as number)} kPa</span> (documented)
              </p>
            ) : null}
            {isCustom && o2Range && kpaRange ? (
              <div className="mt-3 space-y-3">
                <RangeInput
                  id={`${uid}-o2`}
                  label="Oxygen"
                  unit="%"
                  min={o2Range[0]}
                  max={o2Range[1]}
                  step={0.5}
                  value={customO2 ?? o2Range[0]}
                  onChange={setCustomO2}
                />
                <RangeInput
                  id={`${uid}-kpa`}
                  label="Pressure"
                  unit="kPa"
                  min={kpaRange[0]}
                  max={kpaRange[1]}
                  step={0.1}
                  value={customKpa ?? kpaRange[1]}
                  onChange={setCustomKpa}
                />
              </div>
            ) : null}
          </div>
        </div>

        <div className="min-w-0">
          <p className="eyebrow text-muted" id={`${uid}-q`}>
            Question
          </p>
          <div role="group" aria-labelledby={`${uid}-q`} className="mt-1 flex flex-wrap gap-2">
            {QUESTIONS.map((q) => (
              <button
                key={q.id}
                type="button"
                aria-pressed={question === q.id}
                onClick={() => setQuestion(q.id)}
                className={cn(chip, "text-left", question === q.id ? chipOn : chipOff)}
              >
                {q.label}
              </button>
            ))}
          </div>
          <div className="mt-4 rounded-[12px] border border-border bg-subtle p-4 sm:p-5" aria-live="polite" data-testid="ask-answer">
            {body}
            <p className="mt-3 border-t border-border pt-3 text-[13px] leading-5 text-muted">{CLOSING_LINE}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Answer({ sentence, how, gaps }: { sentence: string; how: React.ReactNode; gaps: string[] }) {
  return (
    <div>
      <p className="text-[18px] leading-7 text-fg">{sentence}</p>
      {how ? (
        <p className="mt-2 text-[13px] leading-6 text-muted">
          <span className="font-medium text-fg">How we got this: </span>
          {how}
        </p>
      ) : null}
      {gaps.length ? (
        <div className="mt-3">
          <p className="text-[14px] font-medium leading-5 text-fg">What the ISS tests do not cover for this air</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[14px] leading-5 text-muted">
            {gaps.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function RangeInput(props: {
  id: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
}) {
  const { id, label, unit, min, max, step, value, onChange } = props;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-[14px] leading-5 text-fg">
          {label}
        </label>
        <span className="num text-[14px] text-fg">
          {fmt(value)} {unit}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={Math.min(max, Math.max(min, value))}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 h-10 w-full cursor-pointer accent-[var(--fg)]"
        aria-valuetext={`${fmt(value)} ${unit}`}
      />
      <div className="flex justify-between text-[12px] leading-4 text-muted">
        <span className="num">
          {fmt(min)} {unit}
        </span>
        <span className="num">
          {fmt(max)} {unit}
        </span>
      </div>
    </div>
  );
}
