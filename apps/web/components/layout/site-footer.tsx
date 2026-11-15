import Link from "next/link";
import { DATA_CREDIT, DISCLAIMER, SI_LINK_LABEL, SI_NOTE } from "@/lib/copy";
import { RepoLink } from "./repo-link";
import { VersionChip } from "./version-chip";

/** Short and plain: what this is not, how it was made (one SI line), where the data come from, and (small) which versions produced the numbers. */
export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border">
      <div className="mx-auto flex max-w-[1680px] flex-col gap-1.5 px-4 py-5 text-label text-muted md:flex-row md:items-center md:justify-between md:gap-6 md:px-6">
        <p data-testid="footer-note">
          {DISCLAIMER} {SI_NOTE}{" "}
          <Link href="/methodology#si" className="flex min-h-10 w-fit items-center text-fg underline underline-offset-2 hover:text-accent md:inline-flex md:min-h-0">
            {SI_LINK_LABEL}
          </Link>
        </p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <p>{DATA_CREDIT}</p>
          <VersionChip />
          <RepoLink className="-mx-1.5 h-10 text-label sm:hidden" />
        </div>
      </div>
    </footer>
  );
}
