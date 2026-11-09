import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { parse } from "dotenv";
import { e2eDatabaseUrl } from "./e2e-database";

// Run before the app starts for the browser tests (playwright.config.ts): their database gets every migration (it is
// created on the first run) and the demo data. Both only add what is missing, so a database left by an earlier run
// is reused as it is.

// The app is started with DATABASE_URL already pointing here, so the check compares against the development
// database written in .env, the one that must never be used.
const file = existsSync(".env") ? parse(readFileSync(".env")) : {};
const url = e2eDatabaseUrl({
  ...file,
  E2E_DATABASE_URL: process.env.E2E_DATABASE_URL ?? file.E2E_DATABASE_URL,
});
const env = { ...process.env, DATABASE_URL: url, JOBS_MODE: "inline", RESEND_API_KEY: "" };
execSync("pnpm exec prisma migrate deploy", { env, stdio: "inherit" });
execSync("pnpm db:seed", { env, stdio: "inherit" });
