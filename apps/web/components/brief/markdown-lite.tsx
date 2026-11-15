import { Fragment, type ReactNode } from "react";
import { materialFullName } from "@/components/home/cabins";

/**
 * Minimal renderer for the subset of Markdown that POST /api/brief emits: paragraphs, "- " bullets nested
 * by two-space indent, and bare URLs. No raw HTML is ever interpreted (text nodes only).
 */
const URL_RE = /(https?:\/\/[^\s,;)"]+[^\s,;).:"])/g;

/**
 * Reader-facing cleanup applied to both the screen and the downloaded .md (idempotent; a no-op once the API
 * emits clean text): absent bounds stay missing ("not given", never invented), status codes become words.
 */
const STATUS_WORDS: Record<string, string> = {
  nasa_design_recommendation: "NASA design recommendation",
  documented_nasa: "documented NASA value",
  historical_nasa: "historical NASA value",
  user_hypothetical: "user-selected hypothetical",
};
const BAND_WORDS: Record<string, string> = {
  ventilation_standard_with_near_quiescent_extension: "NASA-STD-3001 ventilation range, extended down to 0.5 cm/s",
  ventilation_standard: "NASA-STD-3001 ventilation range",
  default_band: "default analysis band",
};
const GROUP_ID = "[a-z0-9]+(?:_[a-z0-9]+)*__[a-z0-9_]+";
export function cleanBriefText(text: string): string {
  return text
    // The material line: plain material name and setup instead of "Analysis group: <label> (<raw group id>)", counts in plain words.
    .replace(new RegExp(`Analysis group: (.+?) \\((${GROUP_ID})\\); (\\d+) experiments?, (\\d+) training observations \\((\\d+) sustained, (\\d+) not sustained; (\\d+) % sustained\\)`, "g"),
      (_m, label: string, id: string, ne: string, nt: string, ns: string, nn: string, pct: string) =>
        `Material and setup: ${materialFullName(id, label)}; ${ne} experiments, ${nt} training results (${ns} flame kept burning, ${nn} went out; ${pct} % kept burning)`)
    .replace(new RegExp(` \\((${GROUP_ID})\\)`, "g"), "")
    .replace(/Analysis group:/g, "Material and setup:")
    .replace(/\bCandidate c(\d+)\b/g, "Candidate $1")
    .replace(
      /materially change the estimated probability of a sustained flame over the target region, and how sensitive is that estimate to the assumed pressure correlation\?/g,
      "materially reduce the model's uncertainty about the target region, and how sensitive is that to the assumed pressure correlation?",
    )
    .replace(/ \(min None, max None\)/g, "")
    .replace(/\b(min|max) None\b/g, "$1 not given")
    .replace(/\(status: ([a-z_]+)\)/g, (m, c: string) => (STATUS_WORDS[c] ? `(${STATUS_WORDS[c]})` : m))
    .replace(/\b(ventilation_standard_with_near_quiescent_extension|ventilation_standard|default_band)\b/g, (c: string) => BAND_WORDS[c] ?? c)
    .replace(/airflow_band_source: /g, "band source: ")
    .replace(/p=<0\.001/g, "p<0.001");
}

function inline(raw: string): ReactNode[] {
  const text = cleanBriefText(raw);
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    const i = m.index ?? 0;
    if (i > last) out.push(text.slice(last, i));
    out.push(
      <a key={i} href={m[0]} target="_blank" rel="noopener noreferrer" className="break-words underline underline-offset-2 hover:text-accent">
        {m[0]}
      </a>,
    );
    last = i + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out.map((n, i) => <Fragment key={i}>{n}</Fragment>);
}

interface Item {
  text: string;
  children: Item[];
}

function parse(markdown: string): ({ kind: "p"; text: string } | { kind: "ul"; items: Item[] })[] {
  const blocks: ({ kind: "p"; text: string } | { kind: "ul"; items: Item[] })[] = [];
  let list: { items: Item[]; stack: { depth: number; item: Item }[] } | null = null;
  for (const raw of markdown.split("\n")) {
    if (raw.trim() === "") {
      list = null;
      continue;
    }
    const m = /^(\s*)- (.*)$/.exec(raw);
    if (!m) {
      list = null;
      blocks.push({ kind: "p", text: raw.trim() });
      continue;
    }
    const depth = Math.floor((m[1] ?? "").length / 2);
    const item: Item = { text: m[2] ?? "", children: [] };
    if (!list) {
      const items: Item[] = [];
      list = { items, stack: [] };
      blocks.push({ kind: "ul", items });
    }
    while (list.stack.length > 0 && (list.stack[list.stack.length - 1] as { depth: number }).depth >= depth) list.stack.pop();
    const parent = list.stack[list.stack.length - 1];
    (parent ? parent.item.children : list.items).push(item);
    list.stack.push({ depth, item });
  }
  return blocks;
}

function Items({ items, nested }: { items: Item[]; nested?: boolean }) {
  return (
    <ul className={nested ? "mt-1 list-[circle] space-y-1 pl-5 marker:text-muted" : "list-disc space-y-1.5 pl-5 marker:text-muted"}>
      {items.map((it, i) => (
        <li key={i} className={nested ? "text-[0.93em] text-muted" : undefined}>
          {inline(it.text)}
          {it.children.length > 0 ? <Items items={it.children} nested /> : null}
        </li>
      ))}
    </ul>
  );
}

export function MarkdownLite({ markdown }: { markdown: string }) {
  return (
    <div className="space-y-2.5">
      {parse(markdown).map((b, i) => (b.kind === "p" ? <p key={i}>{inline(b.text)}</p> : <Items key={i} items={b.items} />))}
    </div>
  );
}
