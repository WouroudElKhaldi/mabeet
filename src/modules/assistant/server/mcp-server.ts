import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { RequestId } from "@modelcontextprotocol/sdk/types.js";
import { BRAND } from "@/config/brand";
import { createToolRunner, type ToolCallListener, toolPayload } from "./run-tool";
import type { AiTool, AskPerson } from "./tool";

export interface McpOptions {
  name: string;
  instructions: string;
  tools: readonly AiTool[];
  /** Read at each tool call: a session keeps the caller of its latest request. */
  context: () => unknown;
  onCall?: ToolCallListener;
}

/** How long the person has to answer a pop-up before it counts as a no. */
const POPUP_TIMEOUT_MS = 2 * 60_000;

/**
 * The yes-or-no pop-up of an MCP elicitation, sent with the tool call it belongs to. Only an app that said it can show
 * one (its `elicitation` capability) is asked; closing or ignoring the pop-up is a no.
 */
function askPersonFor(server: McpServer, requestId: RequestId): AskPerson {
  return async (question) => {
    if (!server.server.getClientCapabilities()?.elicitation) return "no-popup";
    try {
      const answer = await server.server.elicitInput(
        { message: question, requestedSchema: { type: "object", properties: {} } },
        { relatedRequestId: requestId, timeout: POPUP_TIMEOUT_MS },
      );
      return answer.action === "accept" ? "yes" : "no";
    } catch {
      return "no";
    }
  };
}

/** An MCP server offering only the tools this caller may use, each marked as read only or as changing data. */
export function buildMcpServer(options: McpOptions): McpServer {
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
      async (args: unknown, extra) => {
        const outcome = await runTool(tool.name, args, askPersonFor(server, extra.requestId));
        return {
          isError: !outcome.ok,
          content: [{ type: "text" as const, text: JSON.stringify(toolPayload(outcome)) }],
        };
      },
    );
  }
  return server;
}

/**
 * Answers one MCP request over Streamable HTTP, statelessly: a new server for each request. With no session there is
 * no pop-up, since the app's answer would arrive at another server.
 */
export async function handleMcpRequest(request: Request, options: McpOptions): Promise<Response> {
  const server = buildMcpServer(options);
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

/** The answer to anything but POST outside a session: there is nothing to stream or close. */
export function methodNotAllowed(): Response {
  return new Response(JSON.stringify({ error: "This MCP endpoint is stateless; use POST." }), {
    status: 405,
    headers: { "content-type": "application/json", allow: "POST" },
  });
}
