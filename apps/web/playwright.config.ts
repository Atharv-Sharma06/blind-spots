import { defineConfig, devices } from "@playwright/test";

/**
 * Self-contained end-to-end suite (headless chromium only, CONTRACTS section 0 rule 8).
 *
 *   npm run test:e2e                      all projects
 *   npx playwright test --project live    live mode: real API on 8205 + web on 3305
 *   npx playwright test --project snapshot  snapshot mode: no API, web on 3306
 *   npx playwright test --project a11y    axe scan against the live web server
 *
 * Servers (started by Playwright, reused when already running outside CI):
 *   API   uv run uvicorn ... --port 8205   (PYTHONPATH=src: the editable-install .pth file is sometimes flagged hidden on this Mac)
 *   live  next build + next start -p 3305   NEXT_DIST_DIR=.next-e2e       NEXT_PUBLIC_DATA_MODE=live
 *   snap  next build + next start -p 3306   NEXT_DIST_DIR=.next-e2e-snap  NEXT_PUBLIC_DATA_MODE=snapshot
 *
 * Production builds are used so the suite is deterministic and fast. Set E2E_DEV=1 to use `next dev`
 * instead (always opened through http://localhost, 127.0.0.1 blocks Next 16 dev resources).
 * The snapshot server points the /api rewrite at a closed port: any request that leaves the snapshot fails.
 */
const API_PORT = 8205;
const LIVE_PORT = 3305;
const SNAP_PORT = 3306;
const DEAD_BACKEND = "http://127.0.0.1:9";
const dev = process.env.E2E_DEV === "1";

const webCommand = (port: number, distDir: string, mode: "live" | "snapshot") => {
  const env = `NEXT_DIST_DIR=${distDir} NEXT_PUBLIC_DATA_MODE=${mode}`;
  const devCmd = `${env} npx next dev -p ${port}`;
  if (dev) return devCmd;
  // Production build for speed and determinism. If the build cannot type-check (for example stray generated files in a
  // sibling .next-* directory matched by tsconfig.json's include globs) fall back to the dev server rather than fail.
  return `(${env} npx next build && ${env} npx next start -p ${port}) || ${devCmd}`;
};

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  outputDir: "./test-results",
  use: {
    headless: true, // never headed on this machine
    trace: "retain-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: "live",
      testIgnore: [/snapshot(\..*)?\.spec\.ts/, /a11y\.spec\.ts/],
      use: { ...devices["Desktop Chrome"], headless: true, baseURL: `http://localhost:${LIVE_PORT}` },
    },
    {
      name: "snapshot",
      testMatch: /snapshot(\..*)?\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], headless: true, baseURL: `http://localhost:${SNAP_PORT}` },
    },
    {
      name: "a11y",
      testMatch: /a11y\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], headless: true, baseURL: `http://localhost:${LIVE_PORT}` },
    },
  ],
  webServer: [
    {
      command: `PYTHONPATH=src uv run uvicorn blindspots.api.app:create_app --factory --host 127.0.0.1 --port ${API_PORT}`,
      cwd: "../../services/analysis",
      url: `http://127.0.0.1:${API_PORT}/api/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: webCommand(LIVE_PORT, ".next-e2e", "live"),
      url: `http://localhost:${LIVE_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 600_000,
      env: { ANALYSIS_API_ORIGIN: `http://127.0.0.1:${API_PORT}` },
    },
    {
      command: webCommand(SNAP_PORT, ".next-e2e-snap", "snapshot"),
      url: `http://localhost:${SNAP_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 600_000,
      env: { ANALYSIS_API_ORIGIN: DEAD_BACKEND },
    },
  ],
});
