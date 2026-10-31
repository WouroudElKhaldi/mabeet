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
