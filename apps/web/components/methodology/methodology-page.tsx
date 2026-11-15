"use client";

import { useState } from "react";
import { useContextEvidence, useGroups, useMethodology, useModelMetadata, useSources, useValidation, type ApiQuery } from "@/hooks/api";
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
import { BuiltSection } from "./section-built";
import { Toc, type TocItem } from "./toc";
import type { ExtValidation } from "./types";

const TOC: TocItem[] = [
  { id: "trust", label: "Can you trust it?" },
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

  return (
    <PageContainer className="flex flex-1 flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <SectionHeader
          as="h1"
          className="min-w-0 flex-1 basis-[28rem]"
          title="Methodology"
          description="How the NASA records were integrated, how the model is fitted and checked, and how research candidates are ranked. Every number on this page comes from the analysis outputs (the live service or its precomputed snapshot)."
        />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[210px_minmax(0,1fr)] lg:gap-10">
        <Toc items={TOC} />
        <div className="min-w-0 max-w-[920px] space-y-12">
          <TrustSection
            validation={validation}
            groups={groups.data?.data}
            onShowGroup={(g) => {
              setPicked(g);
              requestAnimationFrame(() => document.getElementById("validation-detail")?.scrollIntoView({ block: "start" }));
            }}
          />
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
    </PageContainer>
  );
}
