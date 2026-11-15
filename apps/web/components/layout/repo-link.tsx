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
      className={cn("hidden h-10 items-center rounded-md px-1 text-ui text-muted transition-colors hover:text-fg min-[360px]:inline-flex md:h-8 md:px-1.5", className)}
    >
      {repoLabel(REPO_URL)}
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}
