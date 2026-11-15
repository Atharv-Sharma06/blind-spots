import * as React from "react";
import { CloudOff, FileQuestion, PackageX, SearchX, ShieldAlert, ServerCrash } from "lucide-react";
import type { ApiErrorCode } from "@/lib/types";
import { Button } from "./button";
import { cn } from "@/lib/cn";

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
    description: "The analysis service did not respond, so no data can be shown. Check that it is running (default http://127.0.0.1:8000), then retry.",
    icon: CloudOff,
  },
  artifact_missing: {
    title: "Model or dataset artifacts are missing",
    short: "The built dataset or model was not found.",
    description: "The service is running but the built dataset or trained model it needs was not found. Run the dataset build and training pipeline, then retry.",
    icon: PackageX,
  },
  not_found: {
    title: "Not found",
    short: "That record is not in the integrated records.",
    description: "That record does not exist in the integrated records. Check the identifier or go back to the list.",
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
  /** Server message; shown as secondary detail when it adds information. */
  message?: string | null;
  onRetry?: () => void;
  action?: React.ReactNode;
  /** Short form for side panels: title plus one line, no repeated guidance. */
  compact?: boolean;
  align?: "start" | "center";
  className?: string;
}

export function ErrorState({ code, message, onRetry, action, compact, align = "start", className }: ErrorStateProps) {
  const copy = ERROR_COPY[code];
  const Icon = copy.icon;
  return (
    <div role="alert" data-error-code={code} className={cn("flex flex-col gap-1", align === "center" ? "items-center text-center" : "items-start text-left", compact ? "py-3" : "py-8", className)}>
      <Icon className="mb-1 size-5 text-muted" aria-hidden />
      <p className="text-[13px] font-medium text-fg">{copy.title}</p>
      <p className="max-w-[56ch] text-[13px] text-muted">{compact ? copy.short : copy.description}</p>
      {/* The generic proxy message adds nothing; show server detail only when it is specific. */}
      {message && message !== copy.title && code !== "backend_unavailable" ? (
        <p className="num mt-1 max-w-[56ch] break-words text-xs text-muted">{message}</p>
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
