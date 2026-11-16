"use client";

import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";
import { PROVENANCE_LABEL, PROVENANCE_TEXT, type Provenance } from "@/lib/glossary";

export type { Provenance };

/** Small outlined label saying where a number comes from. Words, not colour alone; focusable for its tooltip. */
export function ProvenanceTag({ kind, title, className }: { kind: Provenance; title?: string; className?: string }) {
  const label = PROVENANCE_LABEL[kind];
  return (
    <Tooltip
      content={
        <span>
          {PROVENANCE_TEXT[kind]}
          {title ? (
            <>
              {" "}
              <span className="mt-0.5 block opacity-80">{title}</span>
            </>
          ) : null}
        </span>
      }
    >
      <span
        tabIndex={0}
        data-provenance={kind}
        className={cn(
          "inline-flex shrink-0 cursor-help items-center whitespace-nowrap rounded-full border px-1.5 align-middle font-sans text-[11px] font-medium normal-case leading-[1.35] tracking-normal",
          "border-[color-mix(in_srgb,currentColor_32%,transparent)] text-current",
          className,
        )}
      >
        <span className="sr-only">Source: </span>
        {label}
      </span>
    </Tooltip>
  );
}
