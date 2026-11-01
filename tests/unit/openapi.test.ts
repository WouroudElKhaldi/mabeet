import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// docs/openapi.json is the API contract the brief asks for: every route in src/app/api must be in it, with each
// method it answers. Better Auth's own routes (/api/auth/...) are its library's, documented by Better Auth.

const root = path.resolve(import.meta.dirname, "../..");
const apiFolder = path.join(root, "src/app/api");
const contract = JSON.parse(readFileSync(path.join(root, "docs/openapi.json"), "utf8")) as {
  paths: Record<string, Record<string, unknown>>;
};

function routeFiles(folder: string): string[] {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(folder, entry.name);
    if (entry.isDirectory()) return routeFiles(full);
    return entry.name === "route.ts" ? [full] : [];
  });
}

/** src/app/api/workspaces/[businessId]/rooms/route.ts -> /api/workspaces/{businessId}/rooms */
function contractPath(file: string): string {
  const folder = path.relative(path.join(root, "src/app"), path.dirname(file)).split(path.sep).join("/");
  return `/${folder}`.replace(/\[([^\]]+)\]/g, "{$1}");
}

const routes = routeFiles(apiFolder)
  .filter((file) => !contractPath(file).startsWith("/api/auth/"))
  .map((file) => ({
    path: contractPath(file),
    methods: [...readFileSync(file, "utf8").matchAll(/export const (GET|POST|PUT|PATCH|DELETE)\b/g)].map(
      ([, method]) => method!.toLowerCase(),
    ),
  }));

describe("the API contract", () => {
  it("finds the routes it checks", () => {
    expect(routes.length).toBeGreaterThan(10);
  });

  it.each(routes)("describes $path", ({ path: routePath, methods }) => {
    expect(contract.paths, `${routePath} is missing from docs/openapi.json`).toHaveProperty([routePath]);
    for (const method of methods) {
      expect(contract.paths[routePath], `${method.toUpperCase()} ${routePath}`).toHaveProperty([method]);
    }
  });
});
