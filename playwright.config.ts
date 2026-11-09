import { config } from "dotenv";
import { defineConfig, devices } from "@playwright/test";
import { e2eDatabaseUrl } from "./tests/e2e/e2e-database";

// Browser tests (tests/e2e): a phone-sized Chromium clicks through the built app like a person. The app runs on its
// own database filled with the demo data (E2E_DATABASE_URL, named ..._e2e), so a run never touches development data.
// Build first (`pnpm build`); `pnpm test:e2e` then prepares that database and starts the built app on port 3100, or
// reuses an app already running there.

config({ quiet: true });

const PORT = 3100;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "tests/e2e",
  // One browser at a time: the app, the database and the browser share a small computer.
  workers: 1,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    locale: "en-US",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "sign-in",
      testMatch: /auth\.setup\.ts/,
      use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } },
    },
    {
      name: "mobile",
      dependencies: ["sign-in"],
      use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } },
    },
  ],
  webServer: {
    command: `pnpm exec tsx tests/e2e/prepare-database.ts && pnpm start --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
    env: {
      DATABASE_URL: e2eDatabaseUrl(),
      BETTER_AUTH_URL: baseURL,
      // Jobs run in the request, so a run needs no worker. No outside service is called: emails are logged instead
      // of sent, the AI and card payments are off, and Whish is its simulator.
      JOBS_MODE: "inline",
      RESEND_API_KEY: "",
      DEEPSEEK_API_KEY: "",
      STRIPE_SECRET_KEY: "",
      WHISH_MODE: "simulator",
    },
  },
});
