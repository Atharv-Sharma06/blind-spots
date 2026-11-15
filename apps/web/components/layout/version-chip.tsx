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
/** Chip shows the model family only (e.g. gp-laplace-v1); the full id sits in the tooltip. */
const modelFamily = (v: string | null | undefined) => (v ? (v.split("+")[0] ?? v) : null);

/** Dataset / model version chip fed by GET /api/health. */
export function VersionChip({ className }: { className?: string }) {
  const { state, health, error } = useHealth();
  const data = short(health?.dataset_version);
  const model = modelFamily(health?.model_version) ?? short(health?.model_version);

  let label: React.ReactNode;
  let detail: string;
  if (state === "loading") {
    label = <span>Checking</span>;
    detail = "Checking the analysis service";
  } else if (state === "unavailable") {
    label = <span>Backend unavailable</span>;
    detail = error?.message ?? "The analysis service could not be reached";
  } else {
    label = (
      <>
        {state === "degraded" ? <span className="mr-1">Degraded</span> : null}
        <span>
          data <span className="num">{data ?? "n/a"}</span>
          <span> &middot; model <span className="num">{model ?? "n/a"}</span></span>
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
        aria-label={state === "ok" || state === "degraded" ? `data ${data ?? "n/a"}, model ${model ?? "n/a"}. ${detail}` : `${state === "loading" ? "Checking" : "Backend unavailable"}. ${detail}`}
        className={cn(
          "-mx-1.5 inline-flex h-6 items-center gap-1.5 rounded-sm border border-transparent px-1.5 text-label text-muted transition-colors hover:border-border hover:text-fg",
          className,
        )}
      >
        <Dot state={state} />
        {label}
      </button>
    </Tooltip>
  );
}
