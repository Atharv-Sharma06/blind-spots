/**
 * Number check for "Explain with SI" (pure, no I/O; unit-tested in tests/unit/explain-check.test.mjs).
 *
 * The model is told to use only the facts on the page. This check enforces the numeric part of that rule:
 * every sentence that contains a number which is not in the page context is removed and listed, and every
 * sentence that says "safe" / "unsafe" is removed too (Blind Spots never rates safety).
 */

/** Quantities in text: digits with optional thousands commas and decimals; a leading minus (ASCII or U+2212) counts only
 * when it is not a hyphen inside a word or range ("PSI-25", "22-25"). Digits glued to a letter ("O2", "CO2") are part of a
 * name, not a quantity, and are skipped. */
const NUMBER_RE = /(?<![A-Za-z])(?:(?<![\w)])[-−])?\d+(?:,\d{3})*(?:\.\d+)?/g;

const SAFETY_WORD_RE = /\b(?:un)?safe(?:ly|r|st)?\b/i;

/** "1,234" -> "1234", "−3.50" -> "-3.5", "19%" -> "19"; returns null for anything that is not a finite number. */
export function normalizeNumber(raw: string): string | null {
  const s = raw.replace(/−/g, "-").replace(/,/g, "").replace(/%/g, "").trim();
  if (!/^-?\d+(?:\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return String(n === 0 ? 0 : n);
}

/** Every number written in a string, normalized. */
export function numbersIn(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(NUMBER_RE)) {
    const n = normalizeNumber(m[0]);
    if (n !== null) out.push(n);
  }
  return out;
}

/** Numbers allowed in the explanation: every number written in a context string, and every numeric context value
 * (plus that value rounded to 0, 1 and 2 decimals, so 56.54 may be written 56.5 or 57). */
export function contextNumbers(context: unknown): Set<string> {
  const allowed = new Set<string>();
  const walk = (v: unknown, depth: number): void => {
    if (depth > 8 || v === null || v === undefined) return;
    if (typeof v === "string") {
      for (const n of numbersIn(v)) allowed.add(n);
    } else if (typeof v === "number") {
      if (!Number.isFinite(v)) return;
      for (const d of [0, 1, 2]) {
        const r = normalizeNumber(v.toFixed(d));
        if (r !== null) allowed.add(r);
      }
      const exact = normalizeNumber(String(v));
      if (exact !== null) allowed.add(exact);
    } else if (Array.isArray(v)) {
      for (const x of v) walk(x, depth + 1);
    } else if (typeof v === "object") {
      for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
        for (const n of numbersIn(k)) allowed.add(n);
        walk(x, depth + 1);
      }
    }
  };
  walk(context, 0);
  return allowed;
}

/** Splits prose into sentences (a full stop inside a decimal such as 22.2 is not a boundary). */
export function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?])\s+(?=["'(\[]?[A-Z0-9−-])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export interface ExplainCheckResult {
  /** The sentences that passed, joined with single spaces. */
  text: string;
  /** Sentences removed, in order. */
  removed: string[];
}

/** Keeps only sentences whose numbers all appear in the context and that do not call anything safe or unsafe. */
export function checkExplanation(output: string, context: unknown): ExplainCheckResult {
  const allowed = contextNumbers(context);
  const kept: string[] = [];
  const removed: string[] = [];
  for (const sentence of splitSentences(output)) {
    const unknownNumber = numbersIn(sentence).some((n) => !allowed.has(n));
    if (unknownNumber || SAFETY_WORD_RE.test(sentence)) removed.push(sentence);
    else kept.push(sentence);
  }
  return { text: kept.join(" "), removed };
}
