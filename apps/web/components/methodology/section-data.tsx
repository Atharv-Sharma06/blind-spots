"use client";

import { Badge } from "@/components/ui/badge";
import { Callout } from "@/components/ui/callout";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ApiQuery } from "@/hooks/api";
import type { GroupSummary, MethodologyResponse, SourcesResponse } from "@/lib/types";
import { fmtCount, fmtKpa, fmtPair } from "@/lib/format";
import { Bullets, ExtLink, Formula, Mono, P, QueryBoundary, Section, Sub } from "./primitives";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function countMap(v: unknown): [string, number][] {
  if (!isRecord(v)) return [];
  return Object.entries(v)
    .filter((e): e is [string, number] => typeof e[1] === "number")
    .sort((a, b) => b[1] - a[1]);
}

const REASON_TEXT: Record<string, string> = {
  low_confidence: "Low-confidence curated step or test (kept in the records; added back only in a sensitivity analysis)",
  not_ignited: "Specimen did not ignite: not a flammability outcome",
  n2_suppression: "Flame suppressed by nitrogen: not a flow-driven outcome",
  no_numeric_airflow: "No numeric airflow could be assigned to the step",
  no_curated_flow_steps: "No flow steps curated for the test",
  "context only: different apparatus or test duration": "Context record from another apparatus or test duration",
  "different apparatus and scale: context only": "Context record from a different apparatus and scale",
};

function ReasonTable({ caption, rows }: { caption: string; rows: [string, number][] }) {
  if (rows.length === 0) return <P className="text-muted">No exclusion counts are reported for {caption.toLowerCase()}.</P>;
  return (
    <Table>
      <caption className="sr-only">{caption}</caption>
      <TableHeader>
        <TableRow>
          <TableHead>{caption}</TableHead>
          <TableHead numeric>Count</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map(([reason, n]) => (
          <TableRow key={reason}>
            <TableCell className="h-auto py-1.5">
              <span className="num mr-2 text-xs text-muted">{reason}</span>
              {REASON_TEXT[reason] ? <span className="text-muted">{REASON_TEXT[reason]}</span> : null}
            </TableCell>
            <TableCell numeric>{fmtCount(n)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function DataSection({ methodology, sources, groups }: { methodology: ApiQuery<MethodologyResponse>; sources: ApiQuery<SourcesResponse>; groups: ApiQuery<GroupSummary[]> }) {
  return (
    <Section
      id="data"
      number={1}
      title="Data"
      intro="Where the records come from, what is kept or dropped, how free text and calibrated quantities become numbers, and what is missing."
    >
      <Sub title="Sources">
        <P>
          Models are trained only on the two NASA Physical Sciences Informatics (PSI) investigations below, whose as-run test matrices are public (CC0). Other
          records (Saffire, drop tower, sounding rocket) are shown as context and never used for modelling; they are listed in section 6.
        </P>
        <QueryBoundary query={sources} rows={3}>
          {(s) => {
            const model = s.investigations.filter((i) => i.role === "integrated_model");
            if (model.length === 0) return <P className="text-muted">No investigations are flagged for modelling in the current dataset.</P>;
            return (
              <Table>
                <caption className="sr-only">Investigations used for modelling</caption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Investigation</TableHead>
                    <TableHead>DOI</TableHead>
                    <TableHead>Licence</TableHead>
                    <TableHead>Platform</TableHead>
                    <TableHead numeric>Experiments</TableHead>
                    <TableHead numeric>Observations</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {model.map((i) => (
                    <TableRow key={i.investigation_id}>
                      <TableCell className="h-auto py-2">
                        <ExtLink href={i.landing_url}>
                          {i.acronym} <span className="num text-xs text-muted">({i.investigation_id})</span>
                        </ExtLink>
                        <div className="max-w-[40ch] text-xs text-muted">{i.title}</div>
                      </TableCell>
                      <TableCell>{i.doi ? <ExtLink href={`https://doi.org/${i.doi}`}>{i.doi}</ExtLink> : <span className="text-muted">none recorded</span>}</TableCell>
                      <TableCell className="num">{i.license}</TableCell>
                      <TableCell className="h-auto py-2 text-xs">{i.platform}</TableCell>
                      <TableCell numeric>{fmtCount(i.n_experiments)}</TableCell>
                      <TableCell numeric>{fmtCount(i.n_observations)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            );
          }}
        </QueryBoundary>
      </Sub>

      <Sub title="Inclusion criteria">
        <P>
          The unit of observation is one flow step of one test: the flame was either sustained or not at a recorded airflow and oxygen concentration. Steps of one
          test are correlated, so all validation is grouped by experiment. Labels follow a fixed rule:
        </P>
        <Bullets>
          <li>
            <Mono>sustained</Mono>: label 1 (flame sustained at that setting).
          </li>
          <li>
            <Mono>extinguished</Mono> by low flow, blow-off or at constant flow: label 0. Extinguished because the flow was turned off: label 0 at near-zero flow, flagged{" "}
            <Mono>flow_off_transient</Mono> (not a physical quench boundary).
          </li>
          <li>
            <Mono>brief_flame_no_sustain</Mono>: label 0, flagged <Mono>no_sustained_propagation</Mono>. <Mono>not_ignited</Mono> and <Mono>n2_suppression</Mono> are excluded
            from flammability training.
          </li>
        </Bullets>
        <QueryBoundary query={methodology} rows={2}>
          {(m) => {
            const tf = isRecord(m.config.training_filter) ? m.config.training_filter : {};
            const conf = Array.isArray(tf.confidence_included) ? (tf.confidence_included as unknown[]).map(String) : [];
            return (
              <>
                <P>
                  Training filter: {typeof tf.rule === "string" ? <Mono>{tf.rule}</Mono> : "not reported"}
                  {conf.length ? (
                    <>
                      , with curation confidence in <Mono>{conf.join(", ")}</Mono>
                    </>
                  ) : null}
                  . {typeof tf.excluded_by_default === "string" ? <>Excluded by default: {tf.excluded_by_default}.</> : null}
                </P>
              </>
            );
          }}
        </QueryBoundary>
        <P>
          Observations are analysed only within an <strong>analysis group</strong> (one material family plus one flame configuration), because material, geometry and flow
          configuration change flammability. A group is modelled only with at least 6 training experiments, at least 3 sustained and 3 not-sustained observations, and
          not-sustained outcomes in at least 2 experiments; otherwise coverage is shown but predictions are not (insufficient data).
        </P>
      </Sub>

      <Sub title="Exclusions">
        <QueryBoundary query={methodology} rows={3}>
          {(m) => {
            const tf = isRecord(m.config.training_filter) ? m.config.training_filter : {};
            const ex = isRecord(tf.exclusions_in_dataset) ? tf.exclusions_in_dataset : null;
            if (!ex) return <Callout variant="warning" title="Exclusion counts are not reported by the service">The dataset report did not include them, so none are shown.</Callout>;
            return (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <ReasonTable caption="Observations excluded, by reason" rows={countMap(ex.observations_by_reason)} />
                <ReasonTable caption="Experiments excluded, by reason" rows={countMap(ex.experiments_by_reason)} />
              </div>
            );
          }}
        </QueryBoundary>
        <P className="text-muted">Excluded rows stay in the integrated records with their reason; they are not deleted.</P>
      </Sub>

      <Sub title="Extraction: structured fields and transcribed free text">
        <Bullets>
          <li>
            <strong>Structured fields</strong> are read directly from the NASA workbooks: test labels, material text, specimen dimensions, oxygen concentration, and (BASS only)
            total pressure in atm.
          </li>
          <li>
            <strong>Free text</strong> (flow schedules and outcomes such as a decreasing list of fan settings with &quot;extinguished at&quot;) is interpreted by hand into curation tables. Every
            step records the exact quoted <Mono>raw_token</Mono>, the source cell and row, and a confidence (high, medium, low). Two independent transcriptions per chunk are
            adjudicated, and each chunk is reconciled against the other.
          </li>
          <li>
            <strong>Provenance check.</strong> The pipeline re-opens the original workbook and verifies that every <Mono>raw_token</Mono> is an exact substring of the cited cell. Rows that
            fail are flagged <Mono>provenance_mismatch</Mono> and excluded from training. The same rule applies to BASS-II outcome evidence transcribed from NASA/TM-20210011385
            Appendix A.
          </li>
          <li>
            Interpreted values stay marked: <Mono>extraction_method</Mono> is <Mono>structured_nasa_data</Mono> or <Mono>manually_transcribed</Mono>, and the interpretation confidence travels with the row.
          </li>
        </Bullets>
      </Sub>

      <Sub title="Normalization and unit conversions">
        <Formula label="Unit conversions">{`pressure_kpa = pressure_atm x 101.325
oxygen_percent = oxygen_fraction x 100
airflow_cm_s = 1.0066 x AIR        (duct "Air display" reading, per the BASS-II calibration note)`}</Formula>
        <Bullets>
          <li>
            Fan-display and control-box (pot) settings are converted to cm/s by interpolating the BASS-II fan-calibration table for the same restrictor count, preferring the
            same calibration day, otherwise the nearest day. The calibration reference is stored per observation.
          </li>
          <li>
            <strong>Below the calibrated range</strong> (lowest non-zero calibration point), the curve is linearly extrapolated through its two lowest points, floored at 0 cm/s, and the step is flagged{" "}
            <Mono>below_calibration_range</Mono> and <Mono>flow_extrapolated_linear</Mono> with an uncertainty of at least 0.5 cm/s. This keeps near-quench steps in order; those values are the least certain
            airflow numbers in the dataset. A sensitivity analysis drops them (section 4).
          </li>
          <li>
            BASS has no fan calibration in the integrated files: stated cm/s values are preferred; other settings borrow the BASS-II calibration (flagged, low confidence).
          </li>
          <li>
            Oxygen is linearly interpolated between initial and final values across the steps of a test (flagged); a sensitivity analysis uses the initial value only.
          </li>
        </Bullets>
      </Sub>

      <Sub title="Missing data">
        <P>
          Missing values stay missing. BASS-II test matrices do not record total pressure: the measurement field is empty, and a documented ISS cabin value is stored separately as an
          assumption (<Mono>pressure_assumed_kpa</Mono>, flagged <Mono>pressure_assumed</Mono>). It is used only to place points on pressure axes and in coverage computations. BASS records pressure per test.
        </P>
        <QueryBoundary query={groups} rows={3}>
          {(gs) =>
            gs.length === 0 ? (
              <P className="text-muted">No analysis groups are available.</P>
            ) : (
              <Table containerClassName="max-h-[340px]">
                <caption className="sr-only">Pressure basis per analysis group</caption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Analysis group</TableHead>
                    <TableHead numeric>Experiments</TableHead>
                    <TableHead numeric>Pressure range (kPa)</TableHead>
                    <TableHead>Pressure basis</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gs.map((g) => (
                    <TableRow key={g.group_id}>
                      <TableCell className="h-auto py-1.5">
                        {g.label} <span className="num text-xs text-muted">{g.group_id}</span>
                      </TableCell>
                      <TableCell numeric>{fmtCount(g.n_experiments)}</TableCell>
                      <TableCell numeric>{fmtPair(g.pressure_kpa_range, "", 1)}</TableCell>
                      <TableCell>{g.pressure_measured ? <Badge tone="observed">measured</Badge> : <Badge tone="gap">assumed</Badge>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )
          }
        </QueryBoundary>
        <Callout variant="warning" title="Pressure does not vary in the integrated records">
          Every integrated observation is at about 1 atm, so no pressure effect can be learned from them. Any statement about other pressures is assumption-driven (section 2).
          {" "}
          <span className="num">{fmtKpa(101.325, 3)}</span> is the standard atmosphere used as the reference for the pressure coordinate.
        </Callout>
      </Sub>
    </Section>
  );
}
