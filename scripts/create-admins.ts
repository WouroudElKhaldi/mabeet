/**
 * Creates the platform admins, or gives existing accounts the admin role and a new password, and writes their
 * sign-in details to .admin-credentials (never committed). Run it again at any time: it never makes copies.
 *   pnpm admins:create "Wouroud El Khaldi <wouroud@example.com>" "Fatima Salami <fatima@example.com>"
 * Each admin gets a new random password every run. Share each person's line with them privately.
 */
import { writeFileSync } from "node:fs";
import { config } from "dotenv";

const ADMIN = /^\s*(.+?)\s*<\s*([^<>\s]+@[^<>\s]+)\s*>\s*$/;

function parseAdmins(values: string[]) {
  if (values.length === 0) throw new Error('Name at least one admin: pnpm admins:create "Name <email>"');
  return values.map((value) => {
    const match = ADMIN.exec(value);
    if (!match) throw new Error(`Write each admin as "Name <email>", not "${value}"`);
    return { name: match[1]!, email: match[2]!.toLowerCase() };
  });
}

async function main() {
  config({ quiet: true });
  const admins = parseAdmins(process.argv.slice(2));
  // Loaded after .env, because the server's settings are checked as soon as it is imported.
  const { ensurePlatformAdmin } = await import("@/modules/accounts/server");
  const { secureToken } = await import("@/utils/tokens");
  const { prisma } = await import("@/server/db/client");
  const { env } = await import("@/server/env");

  const lines = [
    "# Mabeet platform admins. Private: never commit or share this file. Give each person only their own line.",
    `# Written ${new Date().toISOString()} for ${new URL(env.BETTER_AUTH_URL).origin}`,
    "",
  ];
  for (const admin of admins) {
    const password = secureToken(18);
    const { created } = await ensurePlatformAdmin({ ...admin, password });
    lines.push(`${admin.name} | ${admin.email} | ${password}`);
    console.log(`${created ? "Created" : "Updated"} platform admin ${admin.email}`);
  }
  writeFileSync(".admin-credentials", `${lines.join("\n")}\n`, { mode: 0o600 });
  console.log("Sign-in details written to .admin-credentials");
  await prisma.$disconnect();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
