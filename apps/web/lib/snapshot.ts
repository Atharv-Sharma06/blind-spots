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

export class SnapshotError extends Error {
  readonly code = "snapshot_unavailable" as const;
  /** True when no manifest could be loaded at all (no snapshot deployed). */
  readonly noManifest: boolean;
  constructor(message: string, noManifest = false) {
    super(message);
    this.name = "SnapshotError";
    this.noManifest = noManifest;
  }
}

interface ManifestIndex {
  manifest: SnapshotManifest;
  normalized: Map<string, string>;
}

let manifestPromise: Promise<ManifestIndex> | null = null;

/** Loads /snapshot/manifest.json once; the result (or failure) is cached for the page session. */
export function loadSnapshotManifest(): Promise<SnapshotManifest> {
  return loadIndex().then((i) => i.manifest);
}

function loadIndex(): Promise<ManifestIndex> {
  if (!manifestPromise) {
    manifestPromise = (async () => {
      let res: Response;
      try {
        res = await fetch(`${SNAPSHOT_BASE}/manifest.json`, { headers: { Accept: "application/json" } });
      } catch {
        throw new SnapshotError("No precomputed snapshot could be loaded.", true);
      }
      if (!res.ok) throw new SnapshotError("No precomputed snapshot is deployed.", true);
      let manifest: SnapshotManifest;
      try {
        manifest = (await res.json()) as SnapshotManifest;
      } catch {
        throw new SnapshotError("The precomputed snapshot manifest is unreadable.", true);
      }
      if (!manifest || typeof manifest !== "object" || typeof manifest.entries !== "object" || manifest.entries === null) {
        throw new SnapshotError("The precomputed snapshot manifest is malformed.", true);
      }
      const normalized = new Map<string, string>();
      for (const k of Object.keys(manifest.entries)) normalized.set(normalizeKey(k), k);
      return { manifest, normalized };
    })();
  }
  return manifestPromise;
}

/** Test hook: forget the cached manifest. */
export function resetSnapshotCache(): void {
  manifestPromise = null;
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

/** Finds the snapshot entry for a request and returns its raw text. Throws SnapshotError (snapshot_unavailable). */
export async function readSnapshotEntry(
  method: "GET" | "POST",
  path: string,
  queryOrBody?: unknown,
  signal?: AbortSignal,
): Promise<SnapshotHit> {
  const { manifest, normalized } = await loadIndex();
  let hitKey: string | null = null;
  for (const cand of snapshotKeyCandidates(method, path, queryOrBody)) {
    if (cand in manifest.entries) {
      hitKey = cand;
      break;
    }
    const alt = normalized.get(normalizeKey(cand));
    if (alt !== undefined) {
      hitKey = alt;
      break;
    }
  }
  if (hitKey === null) {
    throw new SnapshotError("This view requires the live analysis service; it is not part of the precomputed snapshot.");
  }
  const file = manifest.entries[hitKey];
  if (typeof file !== "string") throw new SnapshotError("The snapshot manifest entry is malformed.");
  let res: Response;
  try {
    res = await fetch(snapshotFileUrl(file), { signal });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "AbortError") throw cause;
    throw new SnapshotError("A snapshot file could not be loaded.");
  }
  if (!res.ok) throw new SnapshotError("A snapshot file could not be loaded.");
  return { text: await res.text(), manifest, key: hitKey };
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
  const m = /^(GET|POST) (\/api\/\S*?)(?:\?(\S*)| (.*))?$/.exec(key);
  if (!m) return null;
  const method = m[1] as "GET" | "POST";
  const path = m[2] as string;
  if (method === "GET") {
    const query: QueryParams = {};
    if (m[3]) {
      for (const pair of m[3].split("&")) {
        const i = pair.indexOf("=");
        if (i < 0) return null;
        query[pair.slice(0, i)] = pair.slice(i + 1);
      }
    }
    return { method, path, query };
  }
  try {
    return { method, path, body: m[4] === undefined ? undefined : JSON.parse(m[4]) };
  } catch {
    return null;
  }
}
