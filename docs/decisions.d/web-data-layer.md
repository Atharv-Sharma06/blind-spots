# web-data-layer decisions (2026-11-15)

- All `api.*` functions (except `api.health`) resolve to `ApiResponse<T> = {data, meta: {source, generated_at?, model_version?}}`. `api.health` keeps returning the plain payload because `hooks/use-health.ts` (not owned by this task) predates it; `api.healthWithMeta` returns meta.
- Missing snapshot entry: `ApiError` with `code: "backend_unavailable"` and `snapshotUnavailable: true` (`isSnapshotUnavailable(e)`), NOT a new `snapshot_unavailable` code, because `ERROR_COPY: Record<ApiErrorCode, ...>` in `components/ui/error-state.tsx` (not owned) would stop type-checking. To switch: add the code to `ApiErrorCode` and an `ERROR_COPY` entry ("Requires the live analysis service").
- Snapshot keys: `"<METHOD> <path>"` + `?k=v&...` (GET, sorted, empty omitted) or `" " + canonical JSON` (POST). Lookups fall back to: default axes stripped / default slice or plane filled (coverage, surface), explicit vs omitted `k` and default assumptions (rank), integral floats `10` vs `10.0`, decoded vs encoded experiment ids. The exporter and `snapshotKey` should still agree exactly; `node scripts/check-snapshot-keys.mjs` verifies round-tripping.
- In `auto` mode the manifest is only fetched once the snapshot is actually used; after a live failure live is skipped for 15 s.
- `Range.nominal` is `number | null` (profiles may document only a bound).
- Unit tests: `node --test tests/unit/` (Node 26 type stripping; tested modules have no runtime relative imports).
