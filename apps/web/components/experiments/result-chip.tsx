import * as React from "react";
import { cn } from "@/lib/cn";
import type { ResultKind } from "./model";

/** Same convention as the chart on the home page: filled dot = flame kept burning, hollow ring = went out. */
export function FlameDot({ kind, className }: { kind: ResultKind; className?: string }) {
  if (kind === "burned") return <span aria-hidden className={cn("inline-block size-2.5 shrink-0 rounded-full bg-accent", className)} />;
  if (kind === "out") return <span aria-hidden className={cn("inline-block size-2.5 shrink-0 rounded-full border-2 border-fg bg-surface", className)} />;
  return <span aria-hidden className={cn("inline-block h-0.5 w-2.5 shrink-0 rounded-full bg-muted", className)} />;
}

/** Result of one test: marker plus words (never colour alone), with an optional muted detail line. */
export function ResultChip({ kind, label, detail, large }: { kind: ResultKind; label: string; detail?: string | null; large?: boolean }) {
  return (
    <span className="inline-flex min-w-0 flex-col">
      <span
        data-result={kind}
        className={cn(
          "inline-flex w-fit max-w-full items-center gap-2 rounded-md px-2 py-0.5 font-medium",
          large ? "text-prose px-2.5 py-1" : "text-ui",
          kind === "burned" && "bg-accent-tint text-accent",
          kind === "out" && "bg-subtle text-fg",
          kind === "other" && "text-muted",
        )}
      >
        <FlameDot kind={kind} />
        <span className="min-w-0 whitespace-nowrap">{label}</span>
      </span>
      {detail ? <span className={cn("mt-0.5 text-muted", large ? "text-ui" : "text-xs")}>{detail}</span> : null}
    </span>
  );
}
