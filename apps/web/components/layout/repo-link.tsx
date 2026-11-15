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

function isGitHub(url: string): boolean {
  try {
    return new URL(url).hostname.replace(/^www\./, "") === "github.com";
  } catch {
    return false;
  }
}

/** GitHub-style octocat outline, monochrome. Decorative: the link carries its name as sr-only text. */
export function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden fill="currentColor">
      <path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 0-.8.4-1.3.7-1.6-2.7-.3-5.5-1.3-5.5-6 0-1.2.5-2.3 1.3-3.1-.2-.4-.6-1.6 0-3.2 0 0 1-.3 3.4 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.6 1.6.2 2.8.1 3.2.8.8 1.3 1.9 1.3 3.2 0 4.6-2.8 5.6-5.5 5.9.5.4.9 1.1.9 2.2v3.3c0 .3.1.7.8.6A12 12 0 0 0 12 .3" />
    </svg>
  );
}

/**
 * "icon" (header): a circular outlined button with the GitHub mark (or the words "Source code" for another host).
 * "text" (footer): a quiet text link. "bar" (app top bar): a text button with the mark.
 */
export function RepoLink({ className, variant = "icon" }: { className?: string; variant?: "icon" | "text" | "bar" }) {
  if (!REPO_URL) return null;
  const label = repoLabel(REPO_URL);
  const icon = variant === "icon" && isGitHub(REPO_URL);
  if (variant === "bar") {
    // App top bar: a text button with the GitHub mark, same weight as "Tour".
    return (
      <a
        href={REPO_URL}
        target="_blank"
        rel="noopener noreferrer"
        data-testid="repo-link"
        className={cn(
          "inline-flex h-11 shrink-0 items-center gap-2 rounded-xl px-3 text-[16px] text-fg transition-colors hover:bg-fg/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
          className,
        )}
      >
        {isGitHub(REPO_URL) ? <GitHubIcon /> : null}
        <span>{label}</span>
        <span className="sr-only">(opens in a new tab)</span>
      </a>
    );
  }
  return (
    <a
      href={REPO_URL}
      target="_blank"
      rel="noopener noreferrer"
      data-testid="repo-link"
      title={icon ? label : undefined}
      className={cn(
        "inline-flex shrink-0 items-center justify-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        icon
          ? "size-10 rounded-full border border-fg/15 bg-transparent text-fg hover:bg-fg/5"
          : "h-10 rounded-full px-1 text-ui text-muted underline decoration-fg/25 underline-offset-4 hover:text-fg",
        className,
      )}
    >
      {icon ? <GitHubIcon /> : null}
      <span className={icon ? "sr-only" : undefined}>{label}</span>
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}
