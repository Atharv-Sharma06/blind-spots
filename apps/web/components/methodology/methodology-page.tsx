"use client";

import { useState } from "react";
import { useContextEvidence, useGroups, useHeadline, useMethodology, useModelMetadata, useSources, useValidation, type ApiQuery } from "@/hooks/api";
import { PageContainer } from "@/components/layout/page-container";
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
  { id: "sources", label: "Sources" },
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
      <div className="mx-auto w-full max-w-[1180px] space-y-12">
        <div className="band rounded-[24px] p-5 sm:p-8">
          <h1 className="text-[32px] font-medium leading-[1.1] tracking-[-0.025em] md:text-[40px] md:leading-[44px]">How it works</h1>
          <p className="mt-2 max-w-[62ch] text-[16px] leading-6 text-muted">From NASA&apos;s ISS flame tests to the next test to run.</p>
          <div className="mt-7">
            <FourSteps headline={headline} validation={validation} methodology={methodology} />
          </div>
        </div>
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

      <section id="technical" aria-labelledby="technical-h" className="mx-auto w-full max-w-[1180px] scroll-mt-[calc(var(--header-h)+16px)] border-t border-border-strong pt-10">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div className="min-w-0">
            <h2 id="technical-h" className="text-[28px] font-medium leading-[34px] tracking-[-0.02em]">
              Technical details
            </h2>
            <p className="mt-2 max-w-[68ch] text-[16px] leading-6 text-muted">For reviewers. You do not need these to use the site.</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setSectionOpen("*", true)} className="pill-outline inline-flex min-h-10 items-center px-4 text-[14px] font-medium hover:bg-surface focus-visible:outline-2 focus-visible:outline-accent">
              Open all sections
            </button>
            <button type="button" onClick={() => setSectionOpen("*", false)} className="pill-outline inline-flex min-h-10 items-center px-4 text-[14px] font-medium hover:bg-surface focus-visible:outline-2 focus-visible:outline-accent">
              Close all
            </button>
          </div>
        </div>
        <div className="mt-6 space-y-5">
          <Toc items={TOC} />
          <div className="card min-w-0 px-5 py-2 sm:px-8">
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
