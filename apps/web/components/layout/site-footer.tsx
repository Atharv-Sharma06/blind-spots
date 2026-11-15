import Link from "next/link";
import { DATA_CREDIT, SI_NOTE } from "@/lib/copy";
import { RepoLink } from "./repo-link";

/** One short line: what this is not, how it was made (SI), where the data come from. Versions live on How it works. */
export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border">
      <div className="mx-auto flex max-w-[1680px] flex-wrap items-center gap-x-4 gap-y-0 px-4 py-3 text-label text-muted md:px-6">
        <p data-testid="footer-note" className="py-1">
          Not a certified fire-safety assessment. Not endorsed by NASA.
        </p>
        <Link href="/methodology#si" className="flex min-h-10 items-center text-fg underline underline-offset-2 hover:text-accent md:min-h-0 md:py-1">
          {SI_NOTE}
        </Link>
        <p className="py-1">{DATA_CREDIT}</p>
        <RepoLink className="-mx-1.5 h-10 text-label sm:hidden" />
      </div>
    </footer>
  );
}
