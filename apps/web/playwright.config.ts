import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
// Point the /api/* rewrite at a closed port so the "backend down" path is deterministic.
const DEAD_BACKEND = "http://127.0.0.1:9";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    headless: true, // never headed on this machine (CONTRACTS section 0, rule 8)
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], headless: true } }],
  webServer: {
    command: `npx next build && npx next start -p ${PORT}`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: false,
    timeout: 300_000,
    env: { ANALYSIS_API_ORIGIN: DEAD_BACKEND },
  },
});
