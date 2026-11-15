# scaffold-web decisions

- Next 16.4.6 / React 19.3 / Tailwind 4.3 (CSS-first `@theme`, no tailwind.config). ESLint pinned to 9 (eslint-config-next 16 plugins target it); TypeScript pinned to ~5.9 (7.x native compiler not yet supported by Next's type check).
- Geist fonts come from the `geist` npm package (next/font/local), not Google Fonts: no network at build.
- Hue discipline: status chip uses dot shape, not colour; Callout "warning" uses the warn tint (red), "insufficient" uses the plum uncertainty scale; `--gap-fg` (#8A5200) added as an AA text colour for amber badges because `--gap` (#C97A06) alone fails AA as text.
- Radii capped at 6 px via theme overrides so `rounded-xl` etc. cannot exceed the contract.
- API client: no-envelope 5xx or network failure -> `backend_unavailable`; 404 -> `not_found`; 400/422 -> `validation_error`; other -> `internal`. Health is not retried (fast "unavailable"), polled every 30 s.
- e2e builds with `ANALYSIS_API_ORIGIN=http://127.0.0.1:9` (closed port) so "API down" is deterministic; healthy/envelope cases use `page.route` fixtures (`fixture_health`) in tests only.
- Playwright 1.65 needs chromium headless shell build 1255 (cached 1248 was stale); installed via `npx playwright install chromium` (headless shell only is used).
- `lib/types.ts` field types for `/api/families`, `/api/health.artifacts` are provisional.
