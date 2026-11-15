import * as React from "react";
import { CloudOff, FileQuestion, PackageX, SearchX, ShieldAlert, ServerCrash } from "lucide-react";
import type { ApiErrorCode } from "@/lib/types";
import { Button } from "./button";
import { cn } from "@/lib/cn";
import { isApiError } from "@/lib/api";

interface ErrorCopy {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
}

/** One short sentence per error code. Never shows codes, URLs, file names or stack traces. */
export const ERROR_COPY: Record<ApiErrorCode, ErrorCopy> = {
  backend_unavailable: { title: "Can't load this right now", description: "Please try again in a moment.", icon: CloudOff },
  artifact_missing: { title: "Results aren't ready", description: "Please try again later.", icon: PackageX },
  not_found: { title: "Not found", description: "We couldn't find that.", icon: SearchX },
  validation_error: { title: "Those choices don't work", description: "Change them and try again.", icon: FileQuestion },
  ingestion_failure: { title: "Can't read the data", description: "Please try again later.", icon: ShieldAlert },
  internal: { title: "Something went wrong", description: "Please try again.", icon: ServerCrash },
};

/** Plain copy for a backend_unavailable error that matches its real cause. */
function unavailableReasonCopy(error: unknown): { title: string; description: string } | null {
  if (!isApiError(error) || error.code !== "backend_unavailable") return null;
  if (error.reason === "snapshot_entry_missing") return { title: "Not in this version", description: "This view isn't included here." };
  return null;
}

export interface ErrorStateProps {
  code: ApiErrorCode;
  /** Override the default title / description for this code (e.g. page-level copy). */
  title?: string;
  description?: string;
  /** Server message. Accepted for compatibility but never shown to users. */
  message?: string | null;
  /** The error itself: for `backend_unavailable` its reason picks honest copy (not in this version / unreachable). */
  error?: unknown;
  onRetry?: () => void;
  action?: React.ReactNode;
  /** Tighter padding for side panels. */
  compact?: boolean;
  align?: "start" | "center";
  className?: string;
}

export function ErrorState({ code, title, description, onRetry, action, compact, align = "start", className, error }: ErrorStateProps) {
  const base = ERROR_COPY[code];
  const reasonCopy = error === undefined ? null : unavailableReasonCopy(error);
  const copy = { ...base, title: title ?? reasonCopy?.title ?? base.title, description: description ?? reasonCopy?.description ?? base.description };
  const Icon = copy.icon;
  return (
    <div role="alert" data-error-code={code} className={cn("flex flex-col gap-1", align === "center" ? "items-center text-center" : "items-start text-left", compact ? "py-3" : "py-8", className)}>
      <Icon className="mb-1 size-5 text-muted" aria-hidden />
      <p className="text-prose font-medium text-fg">{copy.title}</p>
      <p className="max-w-[56ch] text-ui text-muted">{copy.description}</p>
      {onRetry || action ? (
        <div className="mt-2 flex items-center gap-2">
          {onRetry ? (
            <Button size="sm" onClick={onRetry}>
              Retry
            </Button>
          ) : null}
          {action}
        </div>
      ) : null}
    </div>
  );
}
