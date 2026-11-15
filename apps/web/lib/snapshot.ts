/**
 * Static snapshot support (docs/API.md "Static snapshot"). Deliberately free of runtime relative
 * imports (type imports only) so `node --test` can load it directly (Node strips the types).
 *
 * Key format, shared with the Python exporter:
 *   GET  : "GET " + path + ("?" + params sorted by name as "k=v" joined by "&", omitted when empty)
 *   POST : "POST " + path + " " + canonical JSON of the body (keys sorted recursively, no spaces)
 */
import type { DataMode, Plane, SnapshotManifest } from "./types";

// ---- Data mode ---------------------------------------------------------------------------

export function parseDataMode(raw: string | undefined | null): DataMode {
  return raw === "live" || raw === "snapshot" || raw === "auto" ? raw : "auto";
}

/** NEXT_PUBLIC_DATA_MODE: live | snapshot | auto (default auto). */
export function getDataMode(): DataMode {
  return parseDataMode(process.env.NEXT_PUBLIC_DATA_MODE);
}

// ---- Keys --------------------------------------------------------------------------------

export type QueryParams = Record<string, string | number | boolean | null | undefined>;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** JSON with object keys sorted recursively and no whitespace. `undefined` members are dropped. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((v) => (v === undefined ? "null" : canonicalJson(v))).join(",")}]`;
  if (isPlainObject(value)) {
    const parts: string[] = [];
    for (const k of Object.keys(value).sort()) {
      const v = value[k];
      if (v === undefined) continue;
      parts.push(`${JSON.stringify(k)}:${canonicalJson(v)}`);
    }
    return `{${parts.join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

/** "k=v" pairs sorted by name; null/undefined/"" are omitted (same rule the live client uses). */
export function canonicalQuery(query: QueryParams | undefined): string {
  if (!query) return "";
  const pairs: string[] = [];
  for (const k of Object.keys(query).sort()) {
    const v = query[k];
    if (v === null || v === undefined || v === "") continue;
    pairs.push(`${k}=${String(v)}`);
  }
  return pairs.join("&");
}

export function snapshotKey(method: "GET" | "POST", path: string, queryOrBody?: unknown): string {
  if (method === "GET") {
    const qs = canonicalQuery(queryOrBody as QueryParams | undefined);
    return qs ? `GET ${path}?${qs}` : `GET ${path}`;
  }
  return `POST ${path} ${canonicalJson(queryOrBody === undefined ? {} : queryOrBody)}`;
}

/** "10.0" and "10" are the same number; Python and JS print integral floats differently. */
export function normalizeKey(key: string): string {
  return key.replace(/(\d)\.0(?![\d])/g, "$1");
}

// ---- Fallback key candidates -------------------------------------------------------------

const AXIS_PARAMS = ["nx", "ny", "x_min", "x_max", "y_min", "y_max"] as const;
const DEFAULT_SLICE: Record<Plane, number> = { o2_flow: 101.3, o2_pressure: 10 };
export const DEFAULT_PRESSURE_LENGTH_SCALE = 0.3;
export const DEFAULT_RANK_K = 3;

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/**
 * Keys to try, exact spec key first. The snapshot is exported at default axes / default assumptions,
 * so a request that spells a default explicitly (or leaves it out) must still find its entry.
 */
export function snapshotKeyCandidates(method: "GET" | "POST", path: string, queryOrBody?: unknown): string[] {
  const out: string[] = [];
  const add = (p: string, qb: unknown) => {
    const k = snapshotKey(method, p, qb);
    if (!out.includes(k)) out.push(k);
  };
  const paths = [path];
  const decoded = safeDecode(path);
  if (decoded !== path) paths.push(decoded);

  for (const p of paths) {
    add(p, queryOrBody);
    if (method === "GET" && (p === "/api/coverage" || p === "/api/surface")) {
      const q = { ...((queryOrBody as QueryParams | undefined) ?? {}) };
      const stripped: QueryParams = { ...q };
      for (const a of AXIS_PARAMS) delete stripped[a];
      add(p, stripped);
      const plane = (q.plane as Plane | undefined) ?? "o2_flow";
      const filled: QueryParams = { ...stripped };
      if (filled.plane == null || filled.plane === "") filled.plane = plane;
      if (filled.slice == null || filled.slice === "") filled.slice = DEFAULT_SLICE[plane] ?? DEFAULT_SLICE.o2_flow;
      add(p, filled);
      const withoutSlice: QueryParams = { ...stripped };
      delete withoutSlice.slice;
      add(p, withoutSlice);
    }
    if (method === "POST" && p === "/api/candidates/rank" && isPlainObject(queryOrBody)) {
      const body = queryOrBody;
      const defaultAssumptions = { pressure_length_scale: DEFAULT_PRESSURE_LENGTH_SCALE };
      for (const withK of [true, false]) {
        for (const assumptions of ["asis", "default", "none"] as const) {
          const b: Record<string, unknown> = { ...body };
          if (!withK) delete b.k;
          else if (b.k === undefined) b.k = DEFAULT_RANK_K;
          if (assumptions === "none") delete b.assumptions;
          else if (assumptions === "default") b.assumptions = defaultAssumptions;
          add(p, b);
        }
      }
    }
  }
  return out;
}

// ---- Manifest + entry loading (browser) --------------------------------------------------

export const SNAPSHOT_BASE = "/snapshot";
export const SNAPSHOT_MANIFEST_URL = `${SNAPSHOT_BASE}/manifest.json`;

export type SnapshotErrorKind =
  /** No manifest could be loaded (network failure, 404, unreadable): no snapshot is deployed or reachable. */
  | "no_manifest"
  /** The manifest loaded but has no entry for this request (needs the live analysis service). */
  | "missing_entry"
  /** The manifest has the entry but its file could not be loaded or parsed. */
  | "bad_file";

export class SnapshotError extends Error {
  readonly code = "snapshot_unavailable" as const;
  readonly kind: SnapshotErrorKind;
  /** True when no manifest could be loaded at all (no snapshot deployed). */
  readonly noManifest: boolean;
  /** HTTP status of the manifest response when it was not ok (404 = no snapshot deployed). */
  readonly status: number | null;
  constructor(message: string, kind: SnapshotErrorKind | boolean = "missing_entry", status: number | null = null) {
    super(message);
    this.name = "SnapshotError";
    // `true` / `false` kept for older call sites: true = no manifest.
    this.kind = kind === true ? "no_manifest" : kind === false ? "missing_entry" : kind;
    this.noManifest = this.kind === "no_manifest";
    this.status = status;
  }
}

interface ManifestIndex {
  manifest: SnapshotManifest;
  normalized: Map<string, string>;
}

let manifestPromise: Promise<ManifestIndex> | null = null;
let manifestLoaded: ManifestIndex | null = null;

/**
 * Loads /snapshot/manifest.json. Only a success is cached for the page session: a failed load (dropped
 * request, cold edge timing out) is forgotten so the next call, e.g. an ErrorState "Retry", fetches again.
 */
export function loadSnapshotManifest(): Promise<SnapshotManifest> {
  return loadIndex().then((i) => i.manifest);
}

/**
 * Starts loading the manifest without waiting for it (call as early as possible in snapshot mode, so the
 * first data request does not pay for an extra round trip after hydration). Never throws.
 */
export function preloadSnapshotManifest(): void {
  loadIndex().catch(() => {
    /* reported by the first real request; the failed promise is not cached */
  });
}

/** The manifest if it has already loaded (synchronous; null otherwise). */
export function loadedSnapshotManifest(): SnapshotManifest | null {
  return manifestLoaded?.manifest ?? null;
}

function loadIndex(): Promise<ManifestIndex> {
  if (manifestLoaded) return Promise.resolve(manifestLoaded);
  if (!manifestPromise) {
    const p = (async () => {
      let res: Response;
      try {
        // A plain GET (no custom headers) so it matches <link rel="preload" as="fetch" crossorigin="anonymous">.
        res = await fetch(SNAPSHOT_MANIFEST_URL);
      } catch {
        throw new SnapshotError("No precomputed snapshot could be loaded.", "no_manifest");
      }
      if (!res.ok) throw new SnapshotError("No precomputed snapshot is deployed.", "no_manifest", res.status);
      let manifest: SnapshotManifest;
      try {
        manifest = (await res.json()) as SnapshotManifest;
      } catch {
        throw new SnapshotError("The precomputed snapshot manifest is unreadable.", "no_manifest");
      }
      if (!manifest || typeof manifest !== "object" || typeof manifest.entries !== "object" || manifest.entries === null) {
        throw new SnapshotError("The precomputed snapshot manifest is malformed.", "no_manifest");
      }
      const normalized = new Map<string, string>();
      for (const k of Object.keys(manifest.entries)) normalized.set(normalizeKey(k), k);
      const index = { manifest, normalized };
      manifestLoaded = index;
      return index;
    })();
    manifestPromise = p;
    // Cache successes only: forget a rejected load so a retry fetches again.
    p.catch(() => {
      if (manifestPromise === p) manifestPromise = null;
    });
  }
  return manifestPromise;
}

/** Test hook: forget the cached manifest. */
export function resetSnapshotCache(): void {
  manifestPromise = null;
  manifestLoaded = null;
}

export function snapshotFileUrl(relativeFile: string): string {
  const parts = relativeFile.replace(/^\/+/, "").split("/").map(encodeURIComponent);
  return `${SNAPSHOT_BASE}/${parts.join("/")}`;
}

export interface SnapshotHit {
  text: string;
  manifest: SnapshotManifest;
  key: string;
}

export interface SnapshotLocation {
  manifest: SnapshotManifest;
  key: string;
  /** Relative file under /snapshot/ (as listed in the manifest). */
  file: string;
  /** URL to fetch or link to. */
  url: string;
}

function findKey(index: ManifestIndex, method: "GET" | "POST", path: string, queryOrBody?: unknown): string | null {
  const { manifest, normalized } = index;
  for (const cand of snapshotKeyCandidates(method, path, queryOrBody)) {
    if (cand in manifest.entries) return cand;
    const alt = normalized.get(normalizeKey(cand));
    if (alt !== undefined) return alt;
  }
  return null;
}

/**
 * Finds the manifest entry for a request without downloading the file (e.g. to build a download link).
 * Throws SnapshotError: kind "no_manifest" when no snapshot is reachable, "missing_entry" when the
 * snapshot has no entry for this request.
 */
export async function resolveSnapshotFile(method: "GET" | "POST", path: string, queryOrBody?: unknown): Promise<SnapshotLocation> {
  const index = await loadIndex();
  const key = findKey(index, method, path, queryOrBody);
  if (key === null) {
    throw new SnapshotError("This view requires the live analysis service; it is not part of the precomputed snapshot.", "missing_entry");
  }
  const file = index.manifest.entries[key];
  if (typeof file !== "string") throw new SnapshotError("The snapshot manifest entry is malformed.", "bad_file");
  return { manifest: index.manifest, key, file, url: snapshotFileUrl(file) };
}

/** Finds the snapshot entry for a request and returns its raw text. Throws SnapshotError (snapshot_unavailable). */
export async function readSnapshotEntry(
  method: "GET" | "POST",
  path: string,
  queryOrBody?: unknown,
  signal?: AbortSignal,
): Promise<SnapshotHit> {
  const loc = await resolveSnapshotFile(method, path, queryOrBody);
  let res: Response;
  try {
    res = await fetch(loc.url, { signal });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "AbortError") throw cause;
    throw new SnapshotError("A snapshot file could not be loaded.", "bad_file");
  }
  if (!res.ok) throw new SnapshotError("A snapshot file could not be loaded.", "bad_file", res.status);
  return { text: await res.text(), manifest: loc.manifest, key: loc.key };
}

// ---- Slice snapping (snapshot mode) --------------------------------------------------------

/** Nearest snapshot slice value for a plane; null when the manifest lists none. */
export function snapSlice(plane: Plane, value: number, slices: SnapshotManifest["slices"] | null | undefined): number | null {
  const list = slices?.[plane];
  if (!list || list.length === 0) return null;
  let best = list[0] as number;
  for (const s of list) if (Math.abs(s - value) < Math.abs(best - value)) best = s;
  return best;
}

// ---- Parity check helper (used by scripts/check-snapshot-keys.mjs) -----------------------------

/**
 * Parses a manifest key back into (method, path, query|body) so that rebuilding it with snapshotKey must
 * reproduce the same string. Returns null if the key is not in the documented format.
 */
export function parseSnapshotKey(key: string): { method: "GET" | "POST"; path: string; query?: QueryParams; body?: unknown } | null {
  const m = /^(GET|POST) (\/api\/.*)$/.exec(key);
  if (!m) return null;
  const method = m[1] as "GET" | "POST";
  const rest = m[2] as string;
  if (method === "GET") {
    // The path may contain spaces (experiment ids such as "PSI-98:SAFFIRE-I S2"); the query starts at "?".
    const qi = rest.indexOf("?");
    const path = qi < 0 ? rest : rest.slice(0, qi);
    const query: QueryParams = {};
    if (qi >= 0) {
      const qs = rest.slice(qi + 1);
      if (!qs) return null;
      for (const pair of qs.split("&")) {
        const i = pair.indexOf("=");
        if (i < 0) return null;
        query[pair.slice(0, i)] = pair.slice(i + 1);
      }
    }
    return { method, path, query };
  }
  // POST: "<path> <canonical JSON>"; the JSON body starts at the first " {" (paths never contain "{").
  const bi = rest.indexOf(" {");
  if (bi < 0) return { method, path: rest, body: undefined };
  try {
    return { method, path: rest.slice(0, bi), body: JSON.parse(rest.slice(bi + 1)) };
  } catch {
    return null;
  }
}
