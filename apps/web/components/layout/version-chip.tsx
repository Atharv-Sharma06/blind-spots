"use client";

import { useHealth, type BackendState } from "@/hooks/use-health";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";

function Dot({ state }: { state: BackendState }) {
  // Shape, not hue, carries state (hues are reserved for data meanings).
  return (
    <span
      aria-hidden
      className={cn(
        "size-1.5 shrink-0 rounded-full",
        state === "ok" && "bg-fg",
        state === "degraded" && "border border-fg bg-subtle ring-1 ring-fg/30",
        state === "loading" && "border border-muted motion-safe:animate-pulse",
        state === "unavailable" && "border border-fg",
      )}
    />
  );
}

const short = (v: string | null | undefined) => (v ? v.slice(0, 12) : null);

/** Dataset version chip fed by GET /api/health. The model id is not printed on the page (it is technical); the tooltip and the accessible name carry both full versions. */
export function VersionChip({ className }: { className?: string }) {
  const { state, health, error } = useHealth();
  const data = short(health?.dataset_version);

  let label: React.ReactNode;
  let detail: string;
  if (state === "loading") {
    label = <span>Checking</span>;
    detail = "Checking the analysis service";
  } else if (state === "unavailable") {
    label = <span>Analysis service unavailable</span>;
    detail = error?.message ?? "The analysis service could not be reached";
  } else {
    label = (
      <>
        {state === "degraded" ? <span className="mr-1">Degraded</span> : null}
        <span>
          Data version <span className="num">{data ?? "n/a"}</span>
        </span>
      </>
    );
    detail =
      (state === "degraded" ? "Service degraded. " : "") +
      `Dataset version ${health?.dataset_version ?? "not built"}; model version ${health?.model_version ?? "not trained"}`;
  }

  return (
    <Tooltip content={detail} side="top" align="end">
      <button
        type="button"
        data-testid="version-chip"
        data-state={state}
        aria-label={state === "ok" || state === "degraded" ? `Data version ${data ?? "n/a"}. ${detail}` : `${state === "loading" ? "Checking" : "Analysis service unavailable"}. ${detail}`}
        className={cn(
          "-mx-1.5 inline-flex h-10 items-center gap-1.5 rounded-sm border border-transparent px-1.5 text-label text-muted transition-colors hover:border-border hover:text-fg md:h-6",
          className,
        )}
      >
        <Dot state={state} />
        {label}
      </button>
    </Tooltip>
  );
}
