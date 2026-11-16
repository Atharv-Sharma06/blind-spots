"use client";

import type * as React from "react";
import { Tooltip } from "@/components/ui/tooltip";
import { GLOSSARY, type GlossaryId } from "@/lib/glossary";

/** Jargon word with a dotted underline; hover or keyboard focus shows one plain sentence. */
export function Term({ id, children }: { id: GlossaryId; children: React.ReactNode }) {
  const entry = GLOSSARY[id];
  return (
    <Tooltip content={entry.text}>
      <span
        tabIndex={0}
        data-term={id}
        className="cursor-help underline decoration-dotted decoration-1 underline-offset-[3px] focus-visible:rounded-sm"
      >
        {children}
      </span>
    </Tooltip>
  );
}
