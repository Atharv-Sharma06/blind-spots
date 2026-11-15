import * as React from "react";
import { cn } from "@/lib/cn";
import type { ResultKind } from "./model";

/** Filled periwinkle dot = flame kept burning, hollow white ring = went out (shape carries the meaning, not only colour). */
export function FlameDot({ kind, className }: { kind: ResultKind; className?: string }) {
  if (kind === "burned") return <span aria-hidden className={cn("inline-block size-2.5 shrink-0 rounded-full bg-observed", className)} />;
  if (kind === "out") return <span aria-hidden className={cn("inline-block size-2.5 shrink-0 rounded-full border-2 border-fg bg-transparent", className)} />;
  return <span aria-hidden className={cn("inline-block h-0.5 w-2.5 shrink-0 rounded-full bg-muted", className)} />;
}

/** Result of one test: marker plus words (never colour alone), with an optional muted detail line. */
export function ResultChip({ kind, label, detail, large }: { kind: ResultKind; label: string; detail?: string | null; large?: boolean }) {
  return (
    <span className="inline-flex min-w-0 flex-col">
      <span
        data-result={kind}
        className={cn(
          "inline-flex w-fit max-w-full items-center gap-2 rounded-full border px-2.5 py-0.5 font-medium",
          large ? "text-prose px-3 py-1" : "text-ui",
          kind === "burned" && "border-transparent bg-observed-tint text-observed",
          kind === "out" && "border-border-strong bg-transparent text-fg",
          kind === "other" && "border-transparent px-0 text-muted",
        )}
      >
        <FlameDot kind={kind} />
        <span className="min-w-0 whitespace-nowrap">{label}</span>
      </span>
      {detail ? <span className={cn("mt-0.5 text-muted", large ? "text-ui" : "text-xs")}>{detail}</span> : null}
    </span>
  );
}
