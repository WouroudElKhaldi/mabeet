import { mcpResourceMetadata } from "@/modules/assistant/server";

/** RFC 9728: tells AI apps which server issues the tokens for the host MCP. */
export async function GET() {
  return Response.json(await mcpResourceMetadata(), {
    headers: { "access-control-allow-origin": "*", "cache-control": "public, max-age=3600" },
  });
}
