import { defineConfig } from "@playwright/test";

// End-to-end flows against a running site with the synthetic demo team (README › Run it locally).
// Locally: E2E_BASE_URL defaults to the demo on 127.0.0.1:3002 and uses the installed Edge.
export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  expect: { timeout: 30_000 },
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://127.0.0.1:3002",
    channel: process.env.CI ? undefined : "msedge",
    // The app is used on a phone at the pool.
    viewport: { width: 375, height: 812 },
    isMobile: true,
    hasTouch: true,
    locale: "pt-PT",
    trace: "retain-on-failure",
  },
});
