import { defineConfig, devices } from "@playwright/test";

/**
 * E2E runs against a real Next dev server + seeded Postgres. Start Postgres
 * (`docker compose up -d`) and seed (`npm run db:seed`) before running.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // shared DB state; keep flows serial
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  timeout: 30_000,
  use: {
    baseURL: "http://localhost:3100",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Dedicated E2E port so a stray dev server on 3000 doesn't clash.
    command: "npx next dev -p 3100",
    url: "http://localhost:3100/login",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
