import { config } from "dotenv";
import { defineConfig, devices } from "@playwright/test";
import { e2eDatabaseUrl } from "./tests/e2e/e2e-database";

// Browser tests (tests/e2e): Google Chrome clicks through the built app like a person, twice: at a phone's size, and in
// a window opened to the whole screen, as a host at their desk sees it. A test only one of them can run is tagged:
// `@phone` (the phone's menus) or `@desktop` (the side menu a full screen shows). The app runs on its
// own database filled with the demo data (E2E_DATABASE_URL, named ..._e2e), so a run never touches development data.
// Build first (`pnpm build`); `pnpm test:e2e` then prepares that database and starts the built app on port 3100, or
// reuses an app already running there. `pnpm test:e2e:headed` opens the Chrome window, to watch each click.

config({ quiet: true });

const PORT = 3100;
const baseURL = `http://localhost:${PORT}`;

const FULL_SCREEN = ["--start-maximized", "--window-size=1366,768"];

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
    // The Google Chrome installed on the computer, as hosts and guests use it, not Playwright's own Chromium.
    channel: "chrome",
    locale: "en-US",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "sign-in",
      testMatch: /auth\.setup\.ts/,
      // Signing in keeps only cookies, so it works for both sizes; it opens to the whole screen.
      use: { viewport: null, launchOptions: { args: FULL_SCREEN } },
    },
    {
      name: "mobile",
      dependencies: ["sign-in"],
      grepInvert: /@desktop/,
      use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } },
    },
    {
      name: "desktop",
      dependencies: ["sign-in"],
      grepInvert: /@phone/,
      // No fixed size: the window opens to the whole screen and the page takes all of it. Without a window (headless)
      // there is no screen, so it takes a laptop's, 1366 by 768.
      use: { viewport: null, launchOptions: { args: FULL_SCREEN } },
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
      // of sent, the AI and card payments are off, Whish is its simulator and photos stay in the database.
      JOBS_MODE: "inline",
      RESEND_API_KEY: "",
      DEEPSEEK_API_KEY: "",
      STRIPE_SECRET_KEY: "",
      WHISH_MODE: "simulator",
      // Photos are kept in the database, so a run never uploads to the real bucket.
      R2_ACCOUNT_ID: "",
      R2_ACCESS_KEY_ID: "",
      R2_SECRET_ACCESS_KEY: "",
      R2_PUBLIC_BUCKET: "",
      R2_PUBLIC_URL: "",
    },
  },
});
