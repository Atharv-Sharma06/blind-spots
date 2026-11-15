"use client";

import { useState } from "react";
import { useContextEvidence, useGroups, useHeadline, useMethodology, useModelMetadata, useSources, useValidation, type ApiQuery } from "@/hooks/api";
import { PageContainer } from "@/components/layout/page-container";
import { SectionHeader } from "@/components/ui/section-header";
import { ActiveLearningSection } from "./section-active";
import { DataSection } from "./section-data";
import { LimitationsSection } from "./section-limitations";
import { ModellingSection } from "./section-modelling";
import { ReproducibilitySection } from "./section-reproducibility";
import { SourcesSection } from "./section-sources";
import { ValidationSection } from "./section-validation";
import { TrustSection } from "./section-trust";
import { BuiltSection, SiNote } from "./section-built";
import { FourSteps } from "./four-steps";
import { setSectionOpen } from "./primitives";
import { Toc, type TocItem } from "./toc";
import type { ExtValidation } from "./types";

/** Anchors of the numbered sections under "Technical details" (the page's trust summary sits above them). */
const TOC: TocItem[] = [
  { id: "data", label: "Data" },
  { id: "modelling", label: "Modelling" },
  { id: "active-learning", label: "Active learning" },
  { id: "validation", label: "Validation" },
  { id: "reproducibility", label: "Reproducibility" },
  { id: "sources", label: "Sources and context" },
  { id: "limitations", label: "Limitations" },
  { id: "built", label: "How this was built" },
];

/** Default group: the API's data-driven default (is_default), else the modelled group with the most training rows. */
function defaultGroup(groups: { group_id: string; model_status: string; n_training: number; is_default?: boolean }[] | undefined, validated: string[] | undefined): string | null {
  const ok = (groups ?? []).filter((g) => g.model_status === "modeled" && (!validated || validated.includes(g.group_id)));
  if (ok.length === 0) return validated?.[0] ?? null;
  const preferred = ok.find((g) => g.is_default);
  return (preferred ?? [...ok].sort((a, b) => b.n_training - a.n_training)[0])?.group_id ?? null;
}

export function MethodologyPage() {
  const methodology = useMethodology();
  const validationRaw = useValidation();
  const sources = useSources();
  const context = useContextEvidence();
  const groups = useGroups();
  const validation = validationRaw as unknown as ApiQuery<ExtValidation>;
  const [picked, setPicked] = useState<string | null>(null);
  const validated = validation.data?.data.groups.map((g) => g.group_id);
  const group = picked ?? defaultGroup(groups.data?.data, validated);
  const metadata = useModelMetadata(group);
  const groupLabel = groups.data?.data.find((g) => g.group_id === group)?.label ?? null;

  const headline = useHeadline();

  return (
    <PageContainer className="flex flex-1 flex-col gap-14">
      <div className="mx-auto w-full max-w-[1100px] space-y-10">
        <SectionHeader
          as="h1"
          title="How it works"
          description="Four steps, from NASA's ISS flame records to the experiment that would teach the most."
        />
        <FourSteps headline={headline} validation={validation} methodology={methodology} />
        <TrustSection
          validation={validation}
          groups={groups.data?.data}
          headline={headline}
          onShowGroup={(g) => {
            setPicked(g);
            setSectionOpen("validation", true);
            window.setTimeout(() => document.getElementById("validation-detail")?.scrollIntoView({ block: "start" }), 80);
          }}
        />
        <SiNote />
      </div>

      <section id="technical" aria-labelledby="technical-h" className="mx-auto w-full max-w-[1100px] scroll-mt-[calc(var(--header-h)+16px)] border-t border-border-strong pt-10">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">For scientists and reviewers</p>
            <h2 id="technical-h" className="mt-1 text-[24px] font-semibold tracking-[-0.02em]">
              Technical details
            </h2>
            <p className="mt-2 max-w-[68ch] text-[14px] leading-relaxed text-muted">
              The data, the model, the checks, the sources and how this was built, in eight numbered sections. You do not need them to use the site.
            </p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setSectionOpen("*", true)} className="inline-flex min-h-10 items-center rounded-md border border-border bg-surface px-3 text-[13px] font-medium hover:bg-subtle">
              Open all sections
            </button>
            <button type="button" onClick={() => setSectionOpen("*", false)} className="inline-flex min-h-10 items-center rounded-md border border-border bg-surface px-3 text-[13px] font-medium hover:bg-subtle">
              Close all
            </button>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[210px_minmax(0,1fr)] lg:gap-10">
          <Toc items={TOC} />
          <div className="min-w-0 border-y border-border">
            <DataSection methodology={methodology} sources={sources} groups={groups} />
            <ModellingSection methodology={methodology} metadata={metadata} groupLabel={groupLabel} />
            <ActiveLearningSection methodology={methodology} />
            <ValidationSection validation={validation} groups={groups.data?.data} group={group} onGroupChange={setPicked} />
            <ReproducibilitySection methodology={methodology} validation={validation} />
            <SourcesSection sources={sources} context={context} />
            <LimitationsSection methodology={methodology} />
            <BuiltSection />
          </div>
        </div>
      </section>
    </PageContainer>
  );
}
