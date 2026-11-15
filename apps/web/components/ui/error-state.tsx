import * as React from "react";
import { CloudOff, FileQuestion, PackageX, SearchX, ShieldAlert, ServerCrash } from "lucide-react";
import type { ApiErrorCode } from "@/lib/types";
import { Button } from "./button";
import { cn } from "@/lib/cn";
import { unavailableCopy } from "@/lib/api";

interface ErrorCopy {
  title: string;
  description: string;
  /** One-line form used when `compact`. */
  short: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
}

/** Copy per CONTRACTS section 8 error code. Plain language: what happened, what to do. */
export const ERROR_COPY: Record<ApiErrorCode, ErrorCopy> = {
  backend_unavailable: {
    title: "Analysis service unavailable",
    short: "No data can be shown until it responds.",
    description:
      process.env.NODE_ENV === "development"
        ? "The analysis service did not respond, so no data can be shown. Check that it is running (default http://127.0.0.1:8000), then retry."
        : "The analysis data could not be loaded, so nothing is shown rather than a guess. Retry in a moment.",
    icon: CloudOff,
  },
  artifact_missing: {
    title: "Model or dataset artifacts are missing",
    short: "The built dataset or model was not found.",
    description:
      process.env.NODE_ENV === "development"
        ? "The service is running but the built dataset or trained model it needs was not found. Run the dataset build and training pipeline, then retry."
        : "The built dataset or trained model was not found, so no results can be shown.",
    icon: PackageX,
  },
  not_found: {
    title: "Not found",
    short: "Nothing matches this address.",
    description: "Nothing exists at this address. Check the link or identifier.",
    icon: SearchX,
  },
  validation_error: {
    title: "The request was not valid",
    short: "Adjust the inputs and try again.",
    description: "One or more inputs are outside what the service accepts. Adjust the highlighted values and try again.",
    icon: FileQuestion,
  },
  ingestion_failure: {
    title: "Data ingestion failed",
    short: "A source file could not be read.",
    description: "The service could not read one of its source files. The details below may help whoever maintains the dataset.",
    icon: ShieldAlert,
  },
  internal: {
    title: "Something went wrong",
    short: "Retry, or report it with the details.",
    description: "The service hit an unexpected error. Retry; if it persists, report it with the details below.",
    icon: ServerCrash,
  },
};

export interface ErrorStateProps {
  code: ApiErrorCode;
  /** Override the default title / description for this code (e.g. page-level copy). */
  title?: string;
  description?: string;
  /** Server message; shown as secondary detail when it adds information. */
  message?: string | null;
  /** The error itself: for `backend_unavailable` its reason picks honest copy (snapshot missing / not in snapshot / unreachable). */
  error?: unknown;
  onRetry?: () => void;
  action?: React.ReactNode;
  /** Short form for side panels: title plus one line, no repeated guidance. */
  compact?: boolean;
  align?: "start" | "center";
  className?: string;
}

export function ErrorState({ code, title, description, message, onRetry, action, compact, align = "start", className, error }: ErrorStateProps) {
  const base = ERROR_COPY[code];
  const reasonCopy = error === undefined ? null : unavailableCopy(error);
  const t = title ?? reasonCopy?.title ?? base.title;
  const d = description ?? reasonCopy?.description;
  const copy = { ...base, title: t, description: d ?? base.description, short: d ?? base.short };
  const Icon = copy.icon;
  return (
    <div role="alert" data-error-code={code} className={cn("flex flex-col gap-1", align === "center" ? "items-center text-center" : "items-start text-left", compact ? "py-3" : "py-8", className)}>
      <Icon className="mb-1 size-5 text-muted" aria-hidden />
      <p className="text-ui font-medium text-fg">{copy.title}</p>
      <p className="max-w-[56ch] text-ui text-muted">{compact ? copy.short : copy.description}</p>
      {/* The generic proxy message adds nothing; show server detail only when it is specific. */}
      {message && message !== copy.title && code !== "backend_unavailable" ? (
        <p className="mt-1 max-w-[56ch] break-words text-label text-muted">{message}</p>
      ) : null}
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
