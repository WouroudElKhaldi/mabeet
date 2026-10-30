/**
 * Writes docs/openapi.yaml from docs/openapi.json, so the API contract can be read (and imported into tools such
 * as Postman or Swagger UI) in either format and the two never drift. Run: pnpm docs:openapi-yaml (part of
 * pnpm docs). Once scripts/openapi.ts generates the JSON from the routes' Zod schemas, `pnpm docs` runs it first.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { stringify } from "yaml";

const contract: unknown = JSON.parse(readFileSync("docs/openapi.json", "utf8"));
const header = "# Generated from docs/openapi.json by `pnpm docs:openapi-yaml`. Never edit it by hand.\n";
writeFileSync(
  "docs/openapi.yaml",
  header + stringify(contract, { lineWidth: 0, aliasDuplicateObjects: false }),
);
console.log("docs/openapi.yaml written");
