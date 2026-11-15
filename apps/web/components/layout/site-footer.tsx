import Link from "next/link";
import { DATA_CREDIT, SI_NOTE } from "@/lib/copy";
import { RepoLink } from "./repo-link";

/** One quiet line: what this is not, how it was made (SI), where the data come from. Versions live on How it works. */
export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-white/[0.06] bg-black/30">
      <div className="mx-auto flex max-w-[1680px] flex-wrap items-center gap-x-5 gap-y-0 px-4 py-4 text-label text-muted md:px-6">
        <p data-testid="footer-note" className="py-1">
          Not a certified fire-safety assessment. Not endorsed by NASA.
        </p>
        <Link
          href="/methodology#si"
          className="flex min-h-10 items-center rounded-full text-fg/85 underline decoration-white/25 underline-offset-4 transition-colors hover:text-accent hover:decoration-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent md:min-h-0 md:py-1"
        >
          {SI_NOTE}
        </Link>
        <p className="py-1">{DATA_CREDIT}</p>
        <RepoLink variant="text" className="-mx-1 text-label sm:hidden" />
      </div>
    </footer>
  );
}
