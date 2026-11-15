import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/cn";

/** Public repository URL, set at build time. Never invented: when unset, no link is rendered. */
export const REPO_URL = process.env.NEXT_PUBLIC_REPO_URL || null;

function repoLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "") === "github.com" ? "GitHub" : "Source code";
  } catch {
    return "Source code";
  }
}

export function RepoLink({ className }: { className?: string }) {
  if (!REPO_URL) return null;
  return (
    <a
      href={REPO_URL}
      target="_blank"
      rel="noopener noreferrer"
      data-testid="repo-link"
      className={cn("inline-flex h-7 items-center gap-1 rounded-md px-1.5 text-ui text-muted transition-colors hover:text-fg", className)}
    >
      {repoLabel(REPO_URL)}
      <ExternalLink className="size-3" aria-hidden />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}
