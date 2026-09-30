import { defineConfig, devices } from "@playwright/test";

/**
 * The core route, end to end (CLAUDE.md, Stack). Runs against the dev server
 * on its own port, on a phone-sized Chromium, since the app is mobile-first.
 */
const PORT = 3200;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    ...devices["Pixel 7"],
    trace: "retain-on-failure",
  },
  // The installed Chrome, so the tests run without downloading Playwright's own browser.
  projects: [{ name: "phone", use: { ...devices["Pixel 7"], channel: "chrome" } }],
  webServer: {
    command: `npm run dev -- -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
