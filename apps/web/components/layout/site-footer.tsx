import { DATA_CREDIT, DISCLAIMER } from "@/lib/copy";
import { RepoLink } from "./repo-link";
import { VersionChip } from "./version-chip";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border">
      <div className="mx-auto flex max-w-[1680px] flex-col gap-2 px-4 py-4 text-label text-muted md:flex-row md:items-center md:justify-between md:gap-6 md:px-6">
        <p>{DISCLAIMER}</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <p>{DATA_CREDIT}</p>
          <VersionChip />
          <RepoLink className="-mx-1.5 h-6 text-label sm:hidden" />
        </div>
      </div>
    </footer>
  );
}
