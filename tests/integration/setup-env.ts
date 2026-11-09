import { config } from "dotenv";
import { testDatabaseUrl } from "./test-database";

// Integration tests run against their own database. Each test creates its own rows with unique names and only
// looks at those, so nothing is ever deleted between tests.
config({ quiet: true });
process.env.DATABASE_URL = testDatabaseUrl();
// Tests never send real email, even when a Resend key is configured for development.
process.env.RESEND_API_KEY = "";
// No worker runs during tests: jobs run in the test process, so each test can wait for them.
process.env.JOBS_MODE = "inline";
// Photos are kept in the database unless a test turns R2 on itself, so a run never uploads to the real bucket, even
// when R2 keys are configured for development.
for (const key of [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_PUBLIC_BUCKET",
  "R2_PUBLIC_URL",
]) {
  process.env[key] = "";
}
