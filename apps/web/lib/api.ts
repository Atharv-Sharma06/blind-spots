import { create } from "zustand";
import {
  getDataMode,
  loadedSnapshotManifest,
  preloadSnapshotManifest,
  readSnapshotEntry,
  resolveSnapshotFile,
  SnapshotError,
  type QueryParams,
} from "./snapshot";
import type {
  ApiErrorCode,
  ApiErrorEnvelope,
  ApiExperiment,
  ApiObservation,
  ApiResponse,
  AssessRequest,
  AssessResponse,
  BriefRequest,
  BriefResponse,
  CompareRequest,
  CompareResponse,
  ContextResponse,
  CounterfactualRequest,
  CounterfactualResponse,
  CoverageResponse,
  ExperimentDetail,
  ExperimentsQuery,
  GridQuery,
  GroupSummary,
  HealthResponse,
  HeadlineResponse,
  Investigation,
  MethodologyResponse,
  ModelMetadata,
  PredictRequest,
  PredictResponse,
  RankRequest,
  RankResponse,
  ResponseMeta,
  SourcesResponse,
  SurfaceResponse,
  TargetsResponse,
  ValidationResponse,
} from "./types";

/** Every failure surfaces as an ApiError with a stable `code` the UI can switch on. */
export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number | null;
  readonly details: Record<string, unknown> | null;
  /**
   * True when the request needs the live service and the precomputed snapshot has no entry for it
   * (the UI says "requires the live analysis service"). `code` is `backend_unavailable` in that case.
   */
  readonly snapshotUnavailable: boolean;
  /**
   * Why `backend_unavailable` happened, for honest copy:
   *  - "service_unreachable": the live analysis service did not answer (and no snapshot could stand in);
   *  - "snapshot_missing": snapshot mode, but /snapshot/manifest.json could not be loaded (nothing deployed);
   *  - "snapshot_entry_missing": the snapshot loaded but has no entry for this request (needs the live service).
   * null for every other code.
   */
  readonly reason: ApiErrorReason | null;

  constructor(
    code: ApiErrorCode,
    message: string,
    opts: {
      status?: number | null;
      details?: Record<string, unknown> | null;
      snapshotUnavailable?: boolean;
      reason?: ApiErrorReason | null;
    } = {},
  ) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = opts.status ?? null;
    this.details = opts.details ?? null;
    this.snapshotUnavailable = opts.snapshotUnavailable ?? false;
    this.reason = opts.reason ?? (code === "backend_unavailable" ? (this.snapshotUnavailable ? "snapshot_entry_missing" : "service_unreachable") : null);
  }
}

export type ApiErrorReason = "service_unreachable" | "snapshot_missing" | "snapshot_entry_missing";

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}

/** The snapshot has no entry for this request: show "requires the live analysis service". */
export function isSnapshotUnavailable(e: unknown): boolean {
  return e instanceof ApiError && e.snapshotUnavailable;
}

/**
 * Plain-language copy for a `backend_unavailable` error that matches its real cause (never tells a
 * visitor of the static snapshot deployment to start a service). null for other errors.
 */
export function unavailableCopy(e: unknown): { title: string; description: string } | null {
  if (!(e instanceof ApiError) || e.code !== "backend_unavailable") return null;
  switch (e.reason) {
    case "snapshot_missing":
      return {
        title: "Snapshot data not found",
        description:
          "This build serves precomputed results from /snapshot/, which is missing or could not be loaded. Retry; if it persists, the snapshot was not deployed with this build.",
      };
    case "snapshot_entry_missing":
      return {
        title: "Not in the precomputed snapshot",
        description: "This view is not part of the precomputed results; it is available in the full (local) version with the analysis service.",
      };
    default:
      return {
        title: "Analysis service unavailable",
        description: "The analysis service did not respond, so no data can be shown. Retry in a moment.",
      };
  }
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

// ---- Data-source status (feeds DataSourceBadge) -----------------------------------------------

export type DataSourceStatus = "unknown" | "live" | "snapshot" | "unavailable";

interface DataSourceState {
  status: DataSourceStatus;
  modelVersion: string | null;
  generatedAt: string | null;
  /** performance.now()-style timestamp of the last live failure (auto mode skips live briefly after one). */
  liveDownAt: number | null;
  report: (s: { status: DataSourceStatus; modelVersion?: string | null; generatedAt?: string | null }) => void;
  markLiveDown: (at: number | null) => void;
}

export const useDataSourceStore = create<DataSourceState>((set) => ({
  status: "unknown",
  modelVersion: null,
  generatedAt: null,
  liveDownAt: null,
  report: ({ status, modelVersion, generatedAt }) =>
    set((s) => ({
      status,
      modelVersion: modelVersion === undefined ? s.modelVersion : modelVersion,
      generatedAt: generatedAt === undefined ? s.generatedAt : generatedAt,
    })),
  markLiveDown: (at) => set({ liveDownAt: at }),
}));

const LIVE_RETRY_AFTER_MS = 15_000;

// ---- Live transport ----------------------------------------------------------------------------

interface RequestOptions {
  query?: QueryParams;
  body?: unknown;
  signal?: AbortSignal;
  /** Response is text (CSV) rather than JSON. */
  text?: boolean;
}

function buildUrl(path: string, query?: QueryParams): string {
  if (!path.startsWith("/api/")) throw new Error(`api only accepts relative /api/* paths, got "${path}"`);
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== null && v !== undefined && v !== "") params.set(k, String(v));
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

/**
 * Fetch from the analysis API through the Next.js /api/* rewrite (no snapshot fallback).
 *
 * Error mapping:
 *  - error envelope in the body -> ApiError with the envelope's code
 *  - network failure, or a 5xx with no envelope (the proxy cannot reach the backend) -> backend_unavailable
 *  - 404 / 400 / 422 without an envelope -> not_found / validation_error
 *  - any other non-2xx -> internal
 */
async function liveFetch<T>(method: "GET" | "POST", path: string, opts: RequestOptions = {}): Promise<T> {
  const { query, body, signal, text } = opts;
  let res: Response;
  try {
    res = await fetch(buildUrl(path, query), {
      method,
      signal,
      headers: { Accept: text ? "text/csv" : "application/json", ...(body !== undefined ? { "Content-Type": "application/json" } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "AbortError") throw cause;
    throw new ApiError("backend_unavailable", "The analysis service could not be reached.");
  }

  const raw = await res.text().catch(() => "");
  if (res.ok) {
    if (text) return raw as unknown as T;
    try {
      if (!raw) throw new Error("empty");
      return JSON.parse(raw) as T;
    } catch {
      throw new ApiError("backend_unavailable", "The analysis service returned an unreadable response.", { status: res.status });
    }
  }

  let parsed: unknown;
  try {
    parsed = raw ? JSON.parse(raw) : undefined;
  } catch {
    parsed = undefined;
  }
  const envelope = parseEnvelope(parsed);
  if (envelope) throw new ApiError(envelope.code, envelope.message, { status: res.status, details: envelope.details });
  if (res.status >= 500) throw new ApiError("backend_unavailable", "The analysis service is unavailable.", { status: res.status });
  if (res.status === 404) throw new ApiError("not_found", "Not found.", { status: res.status });
  if (res.status === 400 || res.status === 422) throw new ApiError("validation_error", "The request was not valid.", { status: res.status });
  throw new ApiError("internal", `Unexpected response (${res.status}).`, { status: res.status });
}

// ---- Mode-aware request ---------------------------------------------------------------------------

/** Experiment detail: the snapshot exports every experiment, so a missing entry means "no such record". */
const DETAIL_PATH = /^\/api\/experiments\/[^/]+$/;

function snapshotToApiError(e: unknown, method: "GET" | "POST", path: string): ApiError {
  if (e instanceof ApiError) return e;
  if (e instanceof SnapshotError) {
    if (e.kind === "no_manifest") {
      return new ApiError("backend_unavailable", e.message, { snapshotUnavailable: true, reason: "snapshot_missing", status: e.status });
    }
    if (e.kind === "missing_entry" && method === "GET" && DETAIL_PATH.test(path)) {
      return new ApiError("not_found", "That record is not in the integrated records.", { status: 404 });
    }
    return new ApiError("backend_unavailable", e.message, { snapshotUnavailable: true, reason: "snapshot_entry_missing" });
  }
  return new ApiError("backend_unavailable", "The precomputed snapshot could not be read.", { snapshotUnavailable: true, reason: "snapshot_entry_missing" });
}

function reportSnapshot(manifest: { model_version?: string | null; generated_at?: string | null } | null): void {
  useDataSourceStore.getState().report({
    status: "snapshot",
    modelVersion: manifest?.model_version ?? null,
    generatedAt: manifest?.generated_at ?? null,
  });
}

async function fromSnapshot<T>(
  method: "GET" | "POST",
  path: string,
  qb: unknown,
  opts: RequestOptions,
): Promise<ApiResponse<T>> {
  try {
    const hit = await readSnapshotEntry(method, path, qb, opts.signal);
    const meta: ResponseMeta = {
      source: "snapshot",
      generated_at: hit.manifest.generated_at,
      model_version: hit.manifest.model_version ?? null,
    };
    reportSnapshot(hit.manifest);
    let data: unknown;
    if (opts.text) data = hit.text;
    else {
      try {
        data = JSON.parse(hit.text);
      } catch {
        throw new SnapshotError("A snapshot file is not valid JSON.", "bad_file");
      }
    }
    return { data: data as T, meta };
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    // Keep the badge honest on a miss too: the manifest answered, so answers come from the snapshot.
    const manifest = loadedSnapshotManifest();
    if (manifest) reportSnapshot(manifest);
    else if (e instanceof SnapshotError && e.kind === "no_manifest") useDataSourceStore.getState().report({ status: "unavailable" });
    throw snapshotToApiError(e, method, path);
  }
}

/**
 * One request through the data layer.
 *  - live:     API only.
 *  - snapshot: never calls the API; reads /snapshot/*.
 *  - auto:     live first; on backend_unavailable falls back to the snapshot.
 * Missing snapshot entries throw an ApiError with snapshotUnavailable === true.
 */
export async function request<T>(
  method: "GET" | "POST",
  path: string,
  opts: RequestOptions = {},
): Promise<ApiResponse<T>> {
  const mode = getDataMode();
  const qb = method === "GET" ? opts.query : opts.body;
  const store = useDataSourceStore.getState();

  if (mode === "snapshot") return fromSnapshot<T>(method, path, qb, opts);

  const skipLive =
    mode === "auto" && store.liveDownAt !== null && Date.now() - store.liveDownAt < LIVE_RETRY_AFTER_MS;

  if (!skipLive) {
    try {
      const data = await liveFetch<T>(method, path, opts);
      if (useDataSourceStore.getState().liveDownAt !== null) useDataSourceStore.setState({ liveDownAt: null });
      useDataSourceStore.getState().report({ status: "live" });
      return { data, meta: { source: "live" } };
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") throw e;
      if (!(e instanceof ApiError) || e.code !== "backend_unavailable") throw e;
      if (mode === "live") {
        useDataSourceStore.getState().report({ status: "unavailable" });
        throw e;
      }
      useDataSourceStore.getState().markLiveDown(Date.now());
      // auto: fall through to the snapshot (fromSnapshot reports the new status, hit or miss).
    }
  }

  try {
    return await fromSnapshot<T>(method, path, qb, opts);
  } catch (e) {
    // auto with no snapshot deployed at all: the honest error is that the service is unreachable.
    if (e instanceof ApiError && e.reason === "snapshot_missing") {
      useDataSourceStore.getState().report({ status: "unavailable" });
      throw new ApiError("backend_unavailable", "The analysis service could not be reached and no precomputed snapshot is available.", {
        reason: "service_unreachable",
      });
    }
    throw e;
  }
}

const get = <T>(path: string, query?: QueryParams, signal?: AbortSignal) => request<T>("GET", path, { query, signal });
const post = <T>(path: string, body: unknown, signal?: AbortSignal) => request<T>("POST", path, { body, signal });

// ---- Typed endpoint functions (docs/API.md) -----------------------------------------------------------

export const api = {
  /** Plain payload (hooks/use-health.ts predates ApiResponse); use healthWithMeta for the source. */
  health: async (signal?: AbortSignal) => (await get<HealthResponse>("/api/health", undefined, signal)).data,
  healthWithMeta: (signal?: AbortSignal) => get<HealthResponse>("/api/health", undefined, signal),
  investigations: (signal?: AbortSignal) => get<Investigation[]>("/api/investigations", undefined, signal),
  groups: (signal?: AbortSignal) => get<GroupSummary[]>("/api/groups", undefined, signal),
  experiments: (query?: ExperimentsQuery, signal?: AbortSignal) =>
    get<ApiExperiment[]>("/api/experiments", query as QueryParams | undefined, signal),
  experiment: (id: string, signal?: AbortSignal) =>
    get<ExperimentDetail>(`/api/experiments/${encodeURIComponent(id)}`, undefined, signal),
  observations: (group?: string | null, signal?: AbortSignal) =>
    get<ApiObservation[]>("/api/observations", { group }, signal),
  targets: (signal?: AbortSignal) => get<TargetsResponse>("/api/targets", undefined, signal),
  /** Finding-strip numbers (LEAD_DECISIONS D1), computed by the backend; also in the snapshot. */
  headline: (signal?: AbortSignal) => get<HeadlineResponse>("/api/headline", undefined, signal),
  context: (signal?: AbortSignal) => get<ContextResponse>("/api/context", undefined, signal),
  coverage: (query: GridQuery, signal?: AbortSignal) =>
    get<CoverageResponse>("/api/coverage", query as unknown as QueryParams, signal),
  surface: (query: GridQuery, signal?: AbortSignal) =>
    get<SurfaceResponse>("/api/surface", query as unknown as QueryParams, signal),
  predict: (body: PredictRequest, signal?: AbortSignal) => post<PredictResponse>("/api/predict", body, signal),
  assessTarget: (body: AssessRequest, signal?: AbortSignal) => post<AssessResponse>("/api/target/assess", body, signal),
  rankCandidates: (body: RankRequest, signal?: AbortSignal) => post<RankResponse>("/api/candidates/rank", body, signal),
  compareCandidates: (body: CompareRequest, signal?: AbortSignal) =>
    post<CompareResponse>("/api/candidates/compare", body, signal),
  counterfactual: (body: CounterfactualRequest, signal?: AbortSignal) =>
    post<CounterfactualResponse>("/api/candidates/counterfactual", body, signal),
  modelMetadata: (group?: string | null, signal?: AbortSignal) =>
    get<ModelMetadata>("/api/model/metadata", { group }, signal),
  validation: (signal?: AbortSignal) => get<ValidationResponse>("/api/model/validation", undefined, signal),
  methodology: (signal?: AbortSignal) => get<MethodologyResponse>("/api/methodology", undefined, signal),
  sources: (signal?: AbortSignal) => get<SourcesResponse>("/api/sources", undefined, signal),
  brief: (body: BriefRequest, signal?: AbortSignal) => post<BriefResponse>("/api/brief", body, signal),
  /** CSV text of normalized experiment records (live or snapshot). */
  exportExperimentsCsv: (query?: { investigation?: string; group?: string }, signal?: AbortSignal) =>
    request<string>("GET", "/api/export/experiments.csv", { query: query as QueryParams | undefined, signal, text: true }),
};

/**
 * href for a download link to the experiments CSV. Live: the API URL. Snapshot (or `snapshot: true`):
 * the snapshot file, looked up in the manifest without downloading it; null when the snapshot has no
 * matching entry.
 */
export async function exportExperimentsCsvHref(
  query: { investigation?: string; group?: string } | undefined,
  opts: { snapshot?: boolean } = {},
): Promise<string | null> {
  const mode = getDataMode();
  const useSnapshot = mode === "snapshot" || opts.snapshot || (mode === "auto" && useDataSourceStore.getState().status === "snapshot");
  if (!useSnapshot) return buildUrl("/api/export/experiments.csv", query as QueryParams | undefined);
  try {
    return (await resolveSnapshotFile("GET", "/api/export/experiments.csv", query)).url;
  } catch {
    return null;
  }
}

// Snapshot builds: start downloading the manifest as soon as the client bundle runs (before hydration and
// before the first query), so data requests do not wait for an extra round trip.
if (typeof window !== "undefined" && getDataMode() === "snapshot") preloadSnapshotManifest();
