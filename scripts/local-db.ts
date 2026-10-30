/**
 * A private PostgreSQL for local development, stored in ./.pgdata and listening on DATABASE_URL's port.
 * No system install or admin rights needed. Run `pnpm db:start` and leave it open; Ctrl+C stops it.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { config } from "dotenv";
import EmbeddedPostgres from "embedded-postgres";

config({ quiet: true });

function connection(variable: string) {
  const raw = process.env[variable];
  if (!raw) throw new Error(`${variable} is not set (see .env.example)`);
  const url = new URL(raw);
  return {
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    port: Number(url.port || 5432),
    database: url.pathname.slice(1),
  };
}

async function main() {
  const primary = connection("DATABASE_URL");
  const test = connection("TEST_DATABASE_URL");
  const databaseDir = path.resolve(".pgdata");
  const firstRun = !existsSync(databaseDir);

  const postgres = new EmbeddedPostgres({
    databaseDir,
    user: primary.user,
    password: primary.password,
    port: primary.port,
    persistent: true,
    // Windows would default to WIN1252, which cannot store Arabic. Force UTF-8 with byte-order collation.
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
  });

  if (firstRun) await postgres.initialise();
  await postgres.start();
  if (firstRun) {
    await postgres.createDatabase(primary.database);
    await postgres.createDatabase(test.database);
  }
  console.log(`PostgreSQL is running on port ${primary.port} (data in .pgdata). Press Ctrl+C to stop.`);

  const stop = async () => {
    await postgres.stop();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
