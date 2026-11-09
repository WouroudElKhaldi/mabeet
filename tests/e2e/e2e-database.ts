// The one place that decides which database the browser tests run on. They add bookings, categories and saved
// settings as a person would, so they refuse any database that is not clearly their own.

/** The browser tests' database: set, different from the development one, and named `..._e2e`. */
export function e2eDatabaseUrl(environment: Record<string, string | undefined> = process.env): string {
  const url = environment.E2E_DATABASE_URL;
  if (!url) throw new Error("E2E_DATABASE_URL is not set (see .env.example)");
  if (url === environment.DATABASE_URL) {
    throw new Error("E2E_DATABASE_URL must not be the same database as DATABASE_URL");
  }
  const name = new URL(url).pathname.slice(1);
  if (!name.endsWith("_e2e")) {
    throw new Error(`The browser tests only run on a database whose name ends in "_e2e", not "${name}"`);
  }
  return url;
}
