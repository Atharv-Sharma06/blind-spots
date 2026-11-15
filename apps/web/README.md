# Blind Spots web app

Next.js (App Router, TypeScript strict) shell for Blind Spots. Contracts: `../../docs/CONTRACTS.md` (sections 8 and 9).

```
npm install
npm run dev          # http://localhost:3000, proxies /api/* to the analysis service
npm run lint && npm run typecheck && npm run build
npm run test:e2e     # Playwright, headless chromium only, serves a production build on :3100
```

- `ANALYSIS_API_ORIGIN` (default `http://127.0.0.1:8000`): target of the `/api/*` rewrite in `next.config.ts`.
- `NEXT_PUBLIC_REPO_URL` (optional): shows a GitHub link in the top bar. See `.env.example`.
- First e2e run needs the browser: `npx playwright install chromium`.

## Layout

- `app/` routes, `providers.tsx` (React Query + tooltips). `styles/globals.css` holds all design tokens (CSS variables + Tailwind theme).
- `components/ui/` primitives (import from `@/components/ui`); `components/layout/` header, footer, nav, version chip; `components/backend-gate.tsx` honest loading/unavailable gate for data panels.
- `lib/types.ts` mirrors CONTRACTS sections 3 and 8 (to be reconciled with `services/analysis/.../api/models.py`); `lib/api.ts` fetch wrapper with typed `ApiError` (`code`); `hooks/use-health.ts`.
- Tokens: `bg surface subtle border fg muted observed gap accent target warn plum-1..7`. One meaning per hue. Use `num` (Geist Mono, tabular) for every measured value. Light theme only.
- Rules: no fabricated numbers in app code; synthetic fixtures only in `tests/` (named `fixture_*`); the exact "insufficient" sentence lives in `lib/copy.ts`.
