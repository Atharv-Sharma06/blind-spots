"use client";

import type { AtmosphereProfile } from "@/lib/types";
import { ProvenanceTag } from "@/components/ui/provenance-tag";
import { sig3 } from "./finding-card";
import type { FindingCabin } from "./types";

/** "Cabins most in the dark": the API's cabin ranking (fewest comparable ISS results first). */
export function CabinRanking({
  cabins,
  profiles,
}: {
  cabins: FindingCabin[];
  profiles: AtmosphereProfile[] | undefined;
}) {
  const status = new Map((profiles ?? []).map((p) => [p.profile_id, p.status]));
  return (
    <section aria-labelledby="cabins-dark" className="flex flex-col gap-4">
      <div>
        <h2 id="cabins-dark" className="text-heading font-medium text-fg">
          Cabins most in the dark
        </h2>
        <p className="mt-1 text-prose text-muted">
          Fewest comparable ISS test results first. Prevention: which cabin air
          the tests already cover.
        </p>
      </div>
      <ol
        className="grid grid-cols-1 gap-3 md:grid-cols-2"
        data-testid="cabin-ranking"
      >
        {cabins.map((c) => {
          const design =
            status.get(c.profile_id) === "nasa_design_recommendation";
          return (
            <li
              key={c.profile_id}
              className="card flex gap-4 p-5"
              data-testid="cabin-rank"
              data-profile={c.profile_id}
            >
              <span
                className="min-w-8 text-[28px] font-medium leading-none tabular-nums text-fg"
                aria-label={`Rank ${c.rank}`}
              >
                {c.rank}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-prose font-medium text-fg break-words">
                    {c.name}
                  </h3>
                  {design ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-0.5 text-label font-medium text-fg">
                      <span
                        aria-hidden
                        className="size-2 rounded-full bg-gap"
                      />
                      Moon/Mars design
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-ui text-muted">
                  {c.oxygen_percent !== null
                    ? `${sig3(c.oxygen_percent)}% oxygen`
                    : "Oxygen not recorded"}
                  {" · "}
                  {c.total_pressure_kpa !== null
                    ? `${sig3(c.total_pressure_kpa)} kPa`
                    : "pressure not recorded"}
                </p>
                <p className="mt-2 text-ui text-fg">
                  {c.sentence.startsWith(`${c.name}: `)
                    ? c.sentence.slice(c.name.length + 2)
                    : c.sentence}{" "}
                  <ProvenanceTag kind="derived" className="align-middle" />
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
