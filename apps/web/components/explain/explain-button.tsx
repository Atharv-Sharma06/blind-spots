"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";

export type ExplainKind = "cabin" | "findings";

interface ExplainResult {
  text: string;
  removed: string[];
  model: string;
}

type ExplainState =
  | { status: "idle" }
  | { status: "loading"; key: string }
  | { status: "done"; key: string; result: ExplainResult }
  | { status: "error"; key: string; message: string };

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

/** GET /api/explain: plain fetch (never the snapshot data client), so a static snapshot deploy without the route reads as disabled. */
function useExplainEnabled(): boolean {
  const q = useQuery({
    queryKey: ["explain", "enabled"],
    queryFn: async ({ signal }) => {
      const res = await fetch("/api/explain", { method: "GET", signal, cache: "no-store" });
      if (!res.ok) return false;
      const body = (await res.json()) as { enabled?: unknown };
      return body.enabled === true;
    },
    staleTime: Infinity,
    retry: false,
  });
  return q.data === true;
}

/** "claude-opus-5-5" -> "Claude Opus 5.5" (the served model; a server-side fallback may name another one). */
export function modelLabel(id: string): string {
  const m = /^claude-([a-z]+)-(\d+)(?:-(\d{1,2}))?(?:-|$)/.exec(id);
  if (!m) return id;
  const family = m[1]!.charAt(0).toUpperCase() + m[1]!.slice(1);
  return `Claude ${family} ${m[2]}${m[3] ? `.${m[3]}` : ""}`;
}

async function postExplain(kind: ExplainKind, context: Record<string, unknown>, signal: AbortSignal): Promise<ExplainResult> {
  const res = await fetch("/api/explain", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, context }),
    signal,
    cache: "no-store",
  });
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (!res.ok) {
    const msg = (body as { error?: { message?: unknown } } | null)?.error?.message;
    throw new Error(typeof msg === "string" ? msg : "The explainer could not answer. Try again.");
  }
  const r = body as Partial<ExplainResult> | null;
  if (!r || typeof r.text !== "string" || !Array.isArray(r.removed) || typeof r.model !== "string") {
    throw new Error("The explainer sent an answer we could not read. Try again.");
  }
  return { text: r.text, removed: r.removed.filter((s): s is string => typeof s === "string"), model: r.model };
}

export interface ExplainButtonProps {
  kind: ExplainKind;
  /** The numbers and sentences currently shown on the page; null while they are still loading. */
  context: Record<string, unknown> | null;
  className?: string;
}

/**
 * "Explain with SI": a pill button that sends the page's own numbers to /api/explain and shows Claude's short reading,
 * clearly labelled and number-checked. Renders nothing when the server has no key.
 */
export function ExplainButton({ kind, context, className }: ExplainButtonProps) {
  const enabled = useExplainEnabled();
  const [state, setState] = React.useState<ExplainState>({ status: "idle" });
  const abortRef = React.useRef<AbortController | null>(null);
  const panelId = React.useId();
  const key = React.useMemo(() => (context ? JSON.stringify(context) : ""), [context]);

  React.useEffect(() => () => abortRef.current?.abort(), []);

  if (!enabled) return null;

  // An explanation belongs to the page state it was asked for; a new cabin or material hides the old one.
  const current = state.status !== "idle" && state.key === key ? state : null;
  const loading = current?.status === "loading";

  const run = () => {
    if (!context || loading) return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    const k = key;
    setState({ status: "loading", key: k });
    postExplain(kind, context, ac.signal).then(
      (result) => {
        if (!ac.signal.aborted) setState({ status: "done", key: k, result });
      },
      (err: unknown) => {
        if (ac.signal.aborted) return;
        setState({ status: "error", key: k, message: err instanceof Error ? err.message : "The explainer could not answer. Try again." });
      },
    );
  };

  return (
    <div className={cn("flex flex-col items-start gap-3", className)} data-testid={`explain-${kind}`}>
      <button
        type="button"
        onClick={run}
        disabled={!context || loading}
        aria-controls={current ? panelId : undefined}
        aria-expanded={current ? true : undefined}
        className={cn(
          "inline-flex min-h-11 items-center gap-2 rounded-full border border-border-strong bg-surface px-5 text-ui font-medium text-fg transition-colors hover:bg-subtle disabled:cursor-not-allowed disabled:opacity-60",
          FOCUS,
        )}
        data-testid="explain-button"
      >
        <Sparkles aria-hidden className="size-4" />
        {loading ? "Explaining…" : current?.status === "done" ? "Explain again" : "Explain with SI"}
      </button>

      {current ? (
        <div id={panelId} className="card w-full max-w-[72ch] p-5 sm:p-6" aria-live="polite" aria-busy={loading} data-testid="explain-card">
          <p className="eyebrow text-muted">
            SI-generated explanation · {current.status === "done" ? modelLabel(current.result.model) : "Claude Opus 5.5"} · checked against the numbers on this page
          </p>
          {current.status === "loading" ? (
            <div className="mt-3 space-y-2" aria-label="Writing the explanation">
              <div className="h-4 w-full max-w-[60ch] animate-pulse rounded bg-subtle motion-reduce:animate-none" />
              <div className="h-4 w-4/5 max-w-[52ch] animate-pulse rounded bg-subtle motion-reduce:animate-none" />
              <div className="h-4 w-3/5 max-w-[40ch] animate-pulse rounded bg-subtle motion-reduce:animate-none" />
            </div>
          ) : current.status === "error" ? (
            <p className="mt-3 text-prose text-fg" role="alert">
              {current.message}
            </p>
          ) : (
            <>
              {current.result.text ? (
                <p className="mt-3 text-prose text-fg" data-testid="explain-text">
                  {current.result.text}
                </p>
              ) : (
                <p className="mt-3 text-prose text-fg">Every sentence failed the number check, so nothing is shown. Try again.</p>
              )}
              {current.result.removed.length > 0 ? (
                <details className="mt-3 text-ui text-muted">
                  <summary className={cn("cursor-pointer rounded-sm py-2 hover:text-fg", FOCUS)}>
                    <span className="underline underline-offset-2">
                      {current.result.removed.length} {current.result.removed.length === 1 ? "sentence" : "sentences"} removed by the number check
                    </span>
                  </summary>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {current.result.removed.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </>
          )}
          <p className="mt-4 border-t border-border pt-3 text-xs leading-5 text-muted">
            Written by an AI model from the numbers on this page and can be wrong; the page itself is the source. Not a fire-safety rating and not endorsed by NASA.
          </p>
        </div>
      ) : null}
    </div>
  );
}
