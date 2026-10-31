import { execSync } from "node:child_process";
import { config } from "dotenv";
import { testDatabaseUrl } from "./test-database";

/**
 * Brings the test database up to date with the migrations, so the raw SQL constraints are exactly what production
 * gets. `migrate deploy` only applies the migrations it has not run yet: it never deletes data.
 */
export default function setup(): void {
  config({ quiet: true });
  const url = testDatabaseUrl();
  execSync("npx prisma migrate deploy", { env: { ...process.env, DATABASE_URL: url }, stdio: "inherit" });
}
