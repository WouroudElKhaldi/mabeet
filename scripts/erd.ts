/**
 * Writes Mermaid entity-relationship diagrams generated from the Prisma schema itself, so they can never drift
 * from the real database. Run: pnpm docs:erd
 *
 * - docs/erd.md: every table and every column, in one diagram.
 * - docs/erd-platform.md and docs/erd-ai-mcp.md: the booking platform and AI/MCP apart, drawn compact (keys,
 *   statuses and kinds) so they read on a screen, with every column one click away.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { Prisma } from "@prisma/client";

type Model = (typeof Prisma.dmmf.datamodel.models)[number];
type Field = Model["fields"][number];

const models = Prisma.dmmf.datamodel.models;
const lines: string[] = ["erDiagram"];

for (const model of models) {
  lines.push(`  ${model.name} {`);
  for (const field of model.fields.filter((candidate) => candidate.kind !== "object")) {
    const type = `${field.type}${field.isList ? "[]" : ""}`.replace(/[^A-Za-z0-9[\]_]/g, "");
    const foreign = model.fields.some(
      (relation) => relation.kind === "object" && relation.relationFromFields?.includes(field.name),
    );
    // Mermaid separates several keys on one column with commas: "UK, FK".
    const keys = [field.isId ? "PK" : field.isUnique ? "UK" : null, foreign ? "FK" : null].filter(Boolean);
    lines.push(`    ${type.replace("[]", "_list")} ${field.name}${keys.length ? ` ${keys.join(", ")}` : ""}`);
  }
  lines.push("  }");
}

// One line per relation, drawn from the side that holds the foreign key.
for (const model of models) {
  for (const field of model.fields) {
    if (field.kind !== "object" || !field.relationFromFields?.length) continue;
    const many = !model.fields.some(
      (other) => other.isUnique && field.relationFromFields?.includes(other.name),
    );
    const optional = !field.isRequired;
    const cardinality = `${optional ? "|o" : "||"}--${many ? "o{" : "o|"}`;
    lines.push(`  ${field.type} ${cardinality} ${model.name} : "${field.name}"`);
  }
}

// ---------- Indexes ----------
// Prisma's runtime metadata has no indexes, so they are read from the schema text: @@index, @@unique and @unique.

function schemaIndexes(): Array<{ table: string; columns: string; kind: string }> {
  const rows: Array<{ table: string; columns: string; kind: string }> = [];
  let table = "";
  for (const line of readFileSync("prisma/schema.prisma", "utf8").split("\n")) {
    const start = /^model (\w+) \{/.exec(line);
    if (start) table = start[1]!;
    if (!table) continue;
    if (line === "}") table = "";
    const block = /^\s+@@(index|unique)\(\[([^\]]+)\](.*)\)/.exec(line);
    if (block) {
      const gin = /type:\s*Gin/.test(block[3] ?? "");
      rows.push({
        table,
        columns: block[2]!.replace(/\s+/g, ""),
        kind: block[1] === "unique" ? "unique" : gin ? "GIN" : "index",
      });
      continue;
    }
    const field = /^\s+(\w+)\s+\S+.*@unique\b/.exec(line);
    if (field && !line.trim().startsWith("//")) rows.push({ table, columns: field[1]!, kind: "unique" });
  }
  return rows;
}

const INDEXES = `## Indexes

Every index besides primary keys and the EXCLUDE constraint's own GiST index. GIN indexes serve the array filters
(tags, accessibility, amenities); the \`status, holdExpiresAt\` ones serve the jobs that expire unanswered or unpaid
bookings.

| Table | Columns | Kind |
| --- | --- | --- |
${schemaIndexes()
  .map((row) => `| ${row.table} | \`${row.columns}\` | ${row.kind} |`)
  .join("\n")}`;

const SQL_GUARANTEES = `Guarantees that Prisma cannot express live in hand-written SQL migrations:

- \`occupancy_no_overlap\`: an EXCLUDE constraint, so no two active stays share a room night.
- \`session_seats_guard\`: a trigger, so a session never sells more seats than it has.
- CHECK constraints on date ranges, guest counts, ratings, seats and payments.`;

const NOT_DRAWN = `Not drawn here: the job queues. pg-boss keeps them in its own \`pgboss\` schema in the same database (jobs, queues,
schedules), creates and upgrades it itself, and nothing reads it through Prisma. See
[Queues and workers](architecture.md#queues-and-workers). Rate-limit counters are not in the database either: they
live in Redis, where each window expires by itself.`;

const doc = `# Database diagram

Generated from \`prisma/schema.prisma\` by \`pnpm docs:erd\`. Do not edit by hand. Easier to read, in two parts:
[the booking platform](erd-platform.md) and [AI and MCP](erd-ai-mcp.md).

${SQL_GUARANTEES}

${NOT_DRAWN}

\`\`\`mermaid
${lines.join("\n")}
\`\`\`

${INDEXES}
`;

writeFileSync("docs/erd.md", doc);
console.log(`docs/erd.md: ${models.length} tables`);

// ---------- The two compact diagrams ----------

/** The AI assistant, its saved chats and costs, queued AI work, and AI apps connecting over MCP (keys, OAuth). */
const AI_AND_MCP = new Set([
  "AiChat",
  "AiChatMessage",
  "AiUsage",
  "JobProgress",
  "ApiKey",
  "McpAuditLog",
  "Jwks",
  "OauthClient",
  "OauthResource",
  "OauthClientResource",
  "OauthAccessToken",
  "OauthRefreshToken",
  "OauthConsent",
  "OauthClientAssertion",
]);

/** Columns worth seeing in a compact diagram besides keys, statuses and kinds. */
const ALSO_SHOWN: Record<string, string[]> = {
  Occupancy: ["checkIn", "checkOut", "active"],
  Booking: ["checkIn", "checkOut", "reference"],
  Room: ["capacity", "bedrooms", "bathrooms"],
  OfferingSession: ["startsAt", "seats"],
  Payment: ["amountCents", "currency"],
  Refund: ["amountCents"],
  Payout: ["amountCents", "currency"],
  AiUsage: ["surface", "costMicroUsd"],
  OauthAccessToken: ["scopes", "expiresAt"],
  OauthConsent: ["scopes", "referenceId"],
};

const isForeignKey = (model: Model, field: Field) =>
  model.fields.some(
    (relation) => relation.kind === "object" && relation.relationFromFields?.includes(field.name),
  );

function columnLine(model: Model, field: Field): string {
  const type = `${field.type}${field.isList ? "[]" : ""}`.replace(/[^A-Za-z0-9[\]_]/g, "");
  const keys = [
    field.isId ? "PK" : field.isUnique ? "UK" : null,
    isForeignKey(model, field) ? "FK" : null,
  ].filter(Boolean);
  return `    ${type.replace("[]", "_list")} ${field.name}${keys.length ? ` ${keys.join(", ")}` : ""}`;
}

const shownInCompact = (model: Model, field: Field) =>
  field.isId ||
  field.isUnique ||
  isForeignKey(model, field) ||
  field.kind === "enum" ||
  (ALSO_SHOWN[model.name]?.includes(field.name) ?? false);

/**
 * The tables in `group`, and their relations. A table outside the group that they point to, or that points to
 * them, is drawn as a bare box, so the diagram shows where it connects without repeating the rest.
 */
function diagram(group: (name: string) => boolean, compact: boolean): string {
  const body = ["erDiagram"];
  for (const model of models.filter((candidate) => group(candidate.name))) {
    const fields = model.fields.filter(
      (field) => field.kind !== "object" && (!compact || shownInCompact(model, field)),
    );
    body.push(`  ${model.name} {`, ...fields.map((field) => columnLine(model, field)), "  }");
  }
  for (const model of models) {
    for (const field of model.fields) {
      if (field.kind !== "object" || !field.relationFromFields?.length) continue;
      if (!group(model.name) && !group(field.type)) continue;
      const many = !model.fields.some(
        (other) => other.isUnique && field.relationFromFields?.includes(other.name),
      );
      body.push(
        `  ${field.type} ${field.isRequired ? "||" : "|o"}--${many ? "o{" : "o|"} ${model.name} : "${field.name}"`,
      );
    }
  }
  return ["```mermaid", ...body, "```"].join("\n");
}

function writeCompact(file: string, title: string, intro: string, group: (name: string) => boolean) {
  const tables = models.filter((model) => group(model.name)).length;
  writeFileSync(
    file,
    `# ${title}

Generated from \`prisma/schema.prisma\` by \`pnpm docs:erd\`. Do not edit by hand. ${intro}

Only the keys, statuses, kinds and a few telling columns are shown; "Every column" below has the full tables. The
whole database in one diagram: [erd.md](erd.md).

${diagram(group, true)}

<details>
<summary>Every column</summary>

${diagram(group, false)}

</details>
`,
  );
  console.log(`${file}: ${tables} tables`);
}

writeCompact(
  "docs/erd-platform.md",
  "Database diagram: the booking platform",
  `Everything except AI and MCP (those are in [erd-ai-mcp.md](erd-ai-mcp.md)): people and teams, places and rooms,
bookings and the nights they hold, calendars, experiences, money, reviews and notifications.

${SQL_GUARANTEES}`,
  (name) => !AI_AND_MCP.has(name),
);

writeCompact(
  "docs/erd-ai-mcp.md",
  "Database diagram: AI and MCP",
  `The assistants' saved chats and costs, live progress of queued answers, and AI apps connecting to a host's data:
personal API keys, OAuth (apps, consents, tokens, signing keys) and the log of every tool call. Boxes with no
columns (\`User\`, \`Business\`, …) are platform tables from [erd-platform.md](erd-platform.md), drawn only to show
where AI connects.

${NOT_DRAWN}`,
  (name) => AI_AND_MCP.has(name),
);
