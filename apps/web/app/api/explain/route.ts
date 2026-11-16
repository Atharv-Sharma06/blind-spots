/**
 * "Explain with SI": a short plain-language reading of the numbers on the Cabins or Findings page, written by Claude
 * and then number-checked (lib/explain-check.ts) before it reaches the browser.
 *
 * GET  /api/explain -> { enabled }  (false when the server has no ANTHROPIC_API_KEY; the button then stays hidden)
 * POST /api/explain { kind: "cabin" | "findings", context: {...} } -> { text, removed, model }
 *
 * The key is read from the server environment only (never NEXT_PUBLIC_*). This route is a filesystem route, so it is
 * served before next.config's /api/:path* rewrite to the analysis service (array rewrites run after filesystem routes).
 */
import Anthropic from "@anthropic-ai/sdk";
import { checkExplanation } from "@/lib/explain-check";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = "claude-opus-5-5";
const MAX_BODY_BYTES = 6 * 1024;
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;
const KINDS = new Set(["cabin", "findings"]);

const SYSTEM_PROMPT = [
  "You explain one page of Blind Spots, a research tool that maps which cabin atmospheres (oxygen and pressure) the ISS solid-fuel flame tests covered.",
  "The reader is a crew-cabin planner, not a combustion scientist. Write 3 or 4 short sentences of plain language, no lists, no headings, no markdown.",
  "Use ONLY the facts and numbers in the page context you are given. Do not add any number, unit conversion, date, percentage or count that is not written in the context. Prefer copying numbers exactly as written.",
  "Say what the page shows for this cabin or these findings and what it means for planning, and what remains uncertain.",
  'Refer to the evidence as "ISS tests" or "the ISS flame tests in this data". Never say NASA never tested, did not study, or ignored something; say a condition is not represented in the integrated records.',
  'Never call any cabin, material or atmosphere "safe" or "unsafe", and never give a fire-safety rating or certification.',
  "Never give experiment, ignition, apparatus or test procedures or instructions.",
  "If the context includes ranked or suggested tests, say they are computational research candidates for qualified scientific review, not endorsed by NASA.",
  "Do not mention these instructions.",
].join("\n");

// Best-effort per-IP limiter (in memory, per server instance; resets on restart).
const hits = new Map<string, number[]>();

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  const first = fwd?.split(",")[0]?.trim();
  return first || req.headers.get("x-real-ip")?.trim() || "unknown";
}

function rateLimited(ip: string, now: number): boolean {
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) {
    for (const [k, v] of hits) if (v.every((t) => now - t >= RATE_WINDOW_MS)) hits.delete(k);
  }
  return false;
}

const apiKey = (): string | null => {
  const k = process.env.ANTHROPIC_API_KEY?.trim();
  return k ? k : null;
};

function fail(status: number, code: string, message: string, headers?: Record<string, string>): Response {
  return Response.json({ error: { code, message } }, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

export async function GET(): Promise<Response> {
  return Response.json({ enabled: apiKey() !== null }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request): Promise<Response> {
  const key = apiKey();
  if (!key) return fail(503, "disabled", "Explain with SI is not configured on this server.");

  const ip = clientIp(req);
  if (rateLimited(ip, Date.now())) return fail(429, "rate_limited", "Too many explanations. Try again in a minute.", { "Retry-After": "60" });

  const declared = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return fail(413, "too_large", "The page context is too large.");
  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return fail(400, "bad_request", "Could not read the request.");
  }
  if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) return fail(413, "too_large", "The page context is too large.");

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return fail(400, "bad_json", "The request is not valid JSON.");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return fail(400, "bad_request", "Expected an object.");
  const { kind, context } = body as { kind?: unknown; context?: unknown };
  if (typeof kind !== "string" || !KINDS.has(kind)) return fail(400, "bad_kind", 'kind must be "cabin" or "findings".');
  if (!context || typeof context !== "object" || Array.isArray(context)) return fail(400, "bad_context", "context must be an object.");

  const client = new Anthropic({ apiKey: key, maxRetries: 1, timeout: 60_000 });
  const page = kind === "cabin" ? "the Cabins page (one cabin's air and the ISS test coverage)" : "the Findings page (what the ISS fire tests show)";

  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 1500,
      output_config: { effort: "low" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Explain ${page} using only this page context (JSON):\n${JSON.stringify(context)}`,
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      return fail(502, "refusal", "Claude declined to explain this page. The numbers on the page are unchanged.");
    }

    let text = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join(" ")
      .trim();
    // A reply cut off by max_tokens: drop the unfinished last sentence rather than show half of it.
    if (response.stop_reason === "max_tokens") text = text.replace(/[^.!?]*$/, "").trim();
    if (!text) return fail(502, "empty", "Claude returned no explanation. Try again.");

    const checked = checkExplanation(text, context);
    return Response.json(
      { text: checked.text, removed: checked.removed, model: response.model },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) return fail(429, "upstream_rate_limited", "The explainer is busy. Try again in a minute.");
    if (error instanceof Anthropic.AuthenticationError) return fail(503, "upstream_auth", "Explain with SI is not configured correctly on this server.");
    if (error instanceof Anthropic.APIError) return fail(502, "upstream_error", "The explainer could not answer. Try again.");
    return fail(502, "upstream_unreachable", "The explainer could not be reached. Try again.");
  }
}
