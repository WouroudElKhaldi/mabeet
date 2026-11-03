import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { BRAND } from "@/config/brand";
import { createToolRunner, type ToolCallListener, toolPayload } from "./run-tool";
import type { AiTool } from "./tool";

interface McpOptions {
  name: string;
  instructions: string;
  tools: readonly AiTool[];
  context: unknown;
  onCall?: ToolCallListener;
}

/**
 * Answers one MCP request over Streamable HTTP, statelessly: a new server for each request, offering only the tools
 * this caller may use, each marked as read only or as changing data.
 */
export async function handleMcpRequest(request: Request, options: McpOptions): Promise<Response> {
  const server = new McpServer(
    { name: `${BRAND.name.toLowerCase()}-${options.name}`, version: "1.0.0" },
    { instructions: options.instructions },
  );
  const runTool = createToolRunner(options.tools, options.context, options.onCall);

  for (const tool of options.tools) {
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: tool.input.shape,
        annotations: { readOnlyHint: !tool.mutates, destructiveHint: tool.mutates, openWorldHint: false },
      },
      async (args: unknown) => {
        const outcome = await runTool(tool.name, args);
        return {
          isError: !outcome.ok,
          content: [{ type: "text" as const, text: JSON.stringify(toolPayload(outcome)) }],
        };
      },
    );
  }

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  try {
    return await transport.handleRequest(request);
  } finally {
    await server.close();
  }
}

/** The answer to anything but POST: the MCP endpoints keep no session to stream or close. */
export function methodNotAllowed(): Response {
  return new Response(JSON.stringify({ error: "This MCP endpoint is stateless; use POST." }), {
    status: 405,
    headers: { "content-type": "application/json", allow: "POST" },
  });
}
