import { Fragment, type ReactNode } from "react";

/**
 * Minimal renderer for the subset of Markdown that POST /api/brief emits: paragraphs, "- " bullets nested
 * by two-space indent, and bare URLs. No raw HTML is ever interpreted (text nodes only).
 */
const URL_RE = /(https?:\/\/[^\s,;)"]+[^\s,;).:"])/g;

function inline(raw: string): ReactNode[] {
  // The API renders an absent bound as Python "None"; show it as "not given" (still missing, never invented).
  const text = raw.replace(/\b(min|max) None\b/g, "$1 not given");
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
