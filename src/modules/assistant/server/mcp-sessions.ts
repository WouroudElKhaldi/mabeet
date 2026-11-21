import { randomUUID } from "node:crypto";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { buildMcpServer, handleMcpRequest, type McpOptions, methodNotAllowed } from "./mcp-server";

// MCP sessions for the host MCP, so our server can ask the person a yes-or-no question in their AI app's pop-up
// (an MCP elicitation) in the middle of a tool call: the app's answer comes back as another request of the same
// session, and finds the tool call still waiting here. Sessions live in this process's memory, which suits the one
// website process we run. An app that starts no session is answered statelessly, as before, without pop-ups.

interface Session {
  /** Whose session it is: the same key, or the same app signed in as the same member in the same place. */
  owner: string;
  transport: WebStandardStreamableHTTPServerTransport;
  /** The caller of the latest request, checked again on every request. */
  context: { current: unknown };
  seenAt: number;
}

/** A session nobody used for this long is closed. */
const IDLE_MS = 30 * 60_000;
/** More open sessions than this close the oldest first. */
const MAX_SESSIONS = 1000;

// Kept on globalThis so a code reload in development keeps the open sessions.
const globalForSessions = globalThis as unknown as { mcpSessions?: Map<string, Session> };
const sessions = (globalForSessions.mcpSessions ??= new Map<string, Session>());

const sessionNotFound = () =>
  new Response(
    JSON.stringify({ jsonrpc: "2.0", error: { code: -32001, message: "Session not found" }, id: null }),
    { status: 404, headers: { "content-type": "application/json" } },
  );

/** Whether this POST opens a session (an MCP `initialize`). */
async function isInitialize(request: Request): Promise<boolean> {
  if (request.method !== "POST") return false;
  try {
    const body: unknown = await request.clone().json();
    const messages = Array.isArray(body) ? body : [body];
    return messages.some(
      (message) =>
        typeof message === "object" &&
        message !== null &&
        "method" in message &&
        message.method === "initialize",
    );
  } catch {
    return false;
  }
}

/** Closes sessions left idle, and the oldest when there are too many. */
async function closeStale(now: number) {
  const byAge = [...sessions.entries()].sort(([, a], [, b]) => a.seenAt - b.seenAt);
  const extra = Math.max(0, byAge.length - MAX_SESSIONS + 1);
  for (const [index, [id, session]] of byAge.entries()) {
    if (index >= extra && now - session.seenAt < IDLE_MS) continue;
    sessions.delete(id);
    await session.transport.close().catch(() => undefined);
  }
}

/**
 * Answers one host MCP request: in its session when it names one (only its own owner's), in a new session when it
 * starts one, and statelessly otherwise. `options.context` is this request's caller, already authenticated.
 */
export async function answerInSession(
  request: Request,
  owner: string,
  options: Omit<McpOptions, "context"> & { context: unknown },
): Promise<Response> {
  const now = Date.now();
  const sessionId = request.headers.get("mcp-session-id");
  if (sessionId) {
    const session = sessions.get(sessionId);
    if (!session || session.owner !== owner) return sessionNotFound();
    session.context.current = options.context;
    session.seenAt = now;
    return session.transport.handleRequest(request);
  }

  if (!(await isInitialize(request))) {
    if (request.method !== "POST") return methodNotAllowed();
    return handleMcpRequest(request, { ...options, context: () => options.context });
  }

  await closeStale(now);
  const context = { current: options.context };
  const server = buildMcpServer({ ...options, context: () => context.current });
  const transport: WebStandardStreamableHTTPServerTransport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: randomUUID,
    onsessioninitialized: (id) => {
      sessions.set(id, { owner, transport, context, seenAt: Date.now() });
    },
    onsessionclosed: (id) => {
      sessions.delete(id);
    },
  });
  await server.connect(transport);
  return transport.handleRequest(request);
}
