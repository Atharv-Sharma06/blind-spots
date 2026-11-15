import { DATA_CREDIT, DISCLAIMER } from "@/lib/copy";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border">
      <div className="mx-auto flex max-w-[1680px] flex-col gap-1 px-4 py-4 text-xs text-muted md:flex-row md:justify-between md:px-6">
        <p>{DISCLAIMER}</p>
        <p>{DATA_CREDIT}</p>
      </div>
    </footer>
  );
}
