// The one place that decides which database the integration tests may use. Tests never delete or empty anything,
// and they refuse to run at all unless the database is clearly a separate test database, so no real data can be
// touched by mistake.

/** The integration tests' database: set, different from the development one, and named `..._test`. */
export function testDatabaseUrl(environment: Record<string, string | undefined> = process.env): string {
  const url = environment.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL is not set (see .env.example)");
  if (url === environment.DATABASE_URL) {
    throw new Error("TEST_DATABASE_URL must not be the same database as DATABASE_URL");
  }
  const name = new URL(url).pathname.slice(1);
  if (!name.endsWith("_test")) {
    throw new Error(`The integration tests only run on a database whose name ends in "_test", not "${name}"`);
  }
  return url;
}
