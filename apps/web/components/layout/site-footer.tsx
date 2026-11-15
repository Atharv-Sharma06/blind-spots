import Link from "next/link";
import { DATA_CREDIT, SI_NOTE } from "@/lib/copy";
import { DataSourceBadge } from "@/components/data-source-badge";
import { RepoLink } from "./repo-link";

/**
 * One quiet block: what this is not, how it was made (SI), where the data come from. Shown on the landing page, the
 * 404 page and (phones only) under the app pages; on desktop the sidebar footer carries the same sentences.
 * `withBadge` adds the data-source chip (app pages on phones, where the sidebar is not on screen).
 */
export function SiteFooter({ className, withBadge = false }: { className?: string; withBadge?: boolean }) {
  return (
    <footer className={className ? `mt-auto border-t border-fg/10 ${className}` : "mt-auto border-t border-fg/10"}>
      <div className="mx-auto flex max-w-[1680px] flex-wrap items-center gap-x-5 gap-y-0 px-4 py-4 text-label text-muted md:px-8">
        {withBadge ? <DataSourceBadge className="my-1" /> : null}
        <p data-testid="footer-note" className="py-1">
          Not a certified fire-safety assessment. Not endorsed by NASA.
        </p>
        <Link
          href="/methodology#si"
          className="flex min-h-10 items-center rounded-full text-fg/85 underline decoration-fg/25 underline-offset-4 transition-colors hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent md:min-h-0 md:py-1"
        >
          {SI_NOTE}
        </Link>
        <p className="py-1">{DATA_CREDIT}</p>
        <RepoLink variant="text" className="-mx-1 text-label" />
      </div>
    </footer>
  );
}
