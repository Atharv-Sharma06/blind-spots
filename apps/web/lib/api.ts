import type {
  ApiErrorCode,
  ApiErrorEnvelope,
  AtmosphereProfile,
  ExperimentDetail,
  ExperimentRecord,
  ExperimentsQuery,
  FamilySummary,
  HealthResponse,
  Investigation,
} from "./types";

/** Every failure surfaces as an ApiError with a stable `code` the UI can switch on. */
export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number | null;
  readonly details: Record<string, unknown> | null;

  constructor(code: ApiErrorCode, message: string, opts: { status?: number | null; details?: Record<string, unknown> | null } = {}) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = opts.status ?? null;
    this.details = opts.details ?? null;
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}

const KNOWN_CODES: ReadonlySet<string> = new Set<ApiErrorCode>([
  "validation_error",
  "not_found",
  "artifact_missing",
  "ingestion_failure",
  "backend_unavailable",
  "internal",
]);

function parseEnvelope(body: unknown): ApiErrorEnvelope["error"] | null {
  if (typeof body !== "object" || body === null || !("error" in body)) return null;
  const err = (body as { error: unknown }).error;
  if (typeof err !== "object" || err === null) return null;
  const { code, message, details } = err as Record<string, unknown>;
  if (typeof code !== "string" || typeof message !== "string") return null;
  return {
    code: (KNOWN_CODES.has(code) ? code : "internal") as ApiErrorCode,
    message,
    details: typeof details === "object" && details !== null ? (details as Record<string, unknown>) : null,
  };
}

type Query = Record<string, string | number | boolean | null | undefined>;

export interface ApiRequestOptions {
  method?: "GET" | "POST";
  query?: Query;
  /** JSON-serialisable request body (POST). */
  body?: unknown;
  signal?: AbortSignal;
}

function buildUrl(path: string, query?: Query): string {
  if (!path.startsWith("/api/")) throw new Error(`apiFetch only accepts relative /api/* paths, got "${path}"`);
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== null && v !== undefined && v !== "") params.set(k, String(v));
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

/**
 * Fetch JSON from the analysis API through the Next.js /api/* rewrite.
 *
 * Error mapping:
 *  - error envelope in the body -> ApiError with the envelope's code
 *  - network failure, or a 5xx with no envelope (the dev/prod proxy cannot reach the backend)
 *    -> backend_unavailable
 *  - 404 / 400 / 422 without an envelope -> not_found / validation_error
 *  - any other non-2xx -> internal
 */
export async function apiFetch<T>(path: string, opts: ApiRequestOptions = {}): Promise<T> {
  const { method = "GET", query, body, signal } = opts;
  let res: Response;
  try {
    res = await fetch(buildUrl(path, query), {
      method,
      signal,
      headers: { Accept: "application/json", ...(body !== undefined ? { "Content-Type": "application/json" } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "AbortError") throw cause;
    throw new ApiError("backend_unavailable", "The analysis service could not be reached.");
  }

  let parsed: unknown = undefined;
  let parseFailed = false;
  const text = await res.text().catch(() => "");
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parseFailed = true;
    }
  }

  if (res.ok) {
    if (parseFailed || (parsed === undefined && res.status !== 204)) {
      throw new ApiError("backend_unavailable", "The analysis service returned an unreadable response.", { status: res.status });
    }
    return parsed as T;
  }

  const envelope = parseEnvelope(parsed);
  if (envelope) return Promise.reject(new ApiError(envelope.code, envelope.message, { status: res.status, details: envelope.details }));
  if (res.status >= 500) throw new ApiError("backend_unavailable", "The analysis service is unavailable.", { status: res.status });
  if (res.status === 404) throw new ApiError("not_found", "Not found.", { status: res.status });
  if (res.status === 400 || res.status === 422) throw new ApiError("validation_error", "The request was not valid.", { status: res.status });
  throw new ApiError("internal", `Unexpected response (${res.status}).`, { status: res.status });
}

// ---- Typed endpoint helpers (add more as feature pages need them) -------------------------

export const api = {
  health: (signal?: AbortSignal) => apiFetch<HealthResponse>("/api/health", { signal }),
  investigations: (signal?: AbortSignal) => apiFetch<Investigation[]>("/api/investigations", { signal }),
  experiments: (query?: ExperimentsQuery, signal?: AbortSignal) =>
    apiFetch<ExperimentRecord[]>("/api/experiments", { query: query as Query | undefined, signal }),
  experiment: (id: string, signal?: AbortSignal) =>
    apiFetch<ExperimentDetail>(`/api/experiments/${encodeURIComponent(id)}`, { signal }),
  families: (signal?: AbortSignal) => apiFetch<FamilySummary[]>("/api/families", { signal }),
  targets: (signal?: AbortSignal) => apiFetch<AtmosphereProfile[]>("/api/targets", { signal }),
};
