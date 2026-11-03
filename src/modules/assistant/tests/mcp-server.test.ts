import { describe, expect, it } from "vitest";
import { z } from "zod";
import { conflict } from "@/server/errors";
import { handleMcpRequest, methodNotAllowed } from "../server/mcp-server";
import { createToolRunner, toolPayload } from "../server/run-tool";
import { defineTool } from "../server/tool";

// What Claude, Cursor and Codex rely on: the tools are listed with their read-only or changes-data mark, a tool runs
// with the caller's context, and a failure comes back as a tool error with no internal details.

const TOOLS = [
  defineTool({
    name: "who_am_i",
    description: "Says whose context the tool ran with.",
    input: z.object({ greeting: z.string().max(20) }),
    mutates: false,
    run: async ({ greeting }, context: { name: string }) => `${greeting}, ${context.name}`,
  }),
  defineTool({
    name: "close_dates",
    description: "Changes data.",
    input: z.object({}),
    mutates: true,
    run: async () => {
      throw conflict("Those nights are already booked or closed.");
    },
  }),
  defineTool({
    name: "broken",
    description: "Fails inside.",
    input: z.object({}),
    mutates: false,
    run: async () => {
      throw new Error("connection string postgres://secret");
    },
  }),
];

let nextId = 1;

/** One JSON-RPC call to the MCP server, as an AI app sends it. */
async function rpc(method: string, params: object = {}) {
  const request = new Request("http://localhost/api/mcp/guest", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
    body: JSON.stringify({ jsonrpc: "2.0", id: nextId++, method, params }),
  });
  const response = await handleMcpRequest(request, {
    name: "test",
    instructions: "Testing.",
    tools: TOOLS,
    context: { name: "Nour" },
  });
  return (await response.json()) as { result?: Record<string, unknown>; error?: unknown };
}

const callText = async (name: string, args: object) => {
  const { result } = await rpc("tools/call", { name, arguments: args });
  const content = result?.content as Array<{ text: string }>;
  return { isError: result?.isError, payload: JSON.parse(content[0]?.text ?? "null") as unknown };
};

describe("the MCP server", () => {
  it("lists every tool with its read-only or changes-data mark", async () => {
    const { result } = await rpc("tools/list");
    const tools = result?.tools as Array<{ name: string; annotations: Record<string, boolean> }>;
    expect(tools.map((tool) => tool.name)).toEqual(["who_am_i", "close_dates", "broken"]);
    expect(tools[0]?.annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false });
    expect(tools[1]?.annotations).toMatchObject({ readOnlyHint: false, destructiveHint: true });
  });

  it("runs a tool with the caller's context", async () => {
    expect(await callText("who_am_i", { greeting: "Hello" })).toEqual({
      isError: false,
      payload: "Hello, Nour",
    });
  });

  it("answers a refusal with its message, and anything else without internal details", async () => {
    expect(await callText("close_dates", {})).toEqual({
      isError: true,
      payload: { error: "Those nights are already booked or closed." },
    });
    const broken = await callText("broken", {});
    expect(broken.isError).toBe(true);
    expect(JSON.stringify(broken.payload)).not.toContain("postgres");
  });

  it("refuses anything but POST", async () => {
    expect(methodNotAllowed().status).toBe(405);
  });
});

describe("the tool runner", () => {
  it("turns wrong input and unknown tools into tool errors", async () => {
    const run = createToolRunner(TOOLS, { name: "Nour" });
    expect(await run("who_am_i", { greeting: 42 })).toMatchObject({ ok: false });
    expect(await run("no_such_tool", {})).toEqual({ ok: false, error: "Unknown tool no_such_tool" });
  });

  it("tells the listener about every call", async () => {
    const calls: string[] = [];
    const run = createToolRunner(TOOLS, { name: "Nour" }, (tool, outcome) =>
      calls.push(`${tool}:${outcome.ok}`),
    );
    await run("who_am_i", { greeting: "Hi" });
    await run("close_dates", {});
    expect(calls).toEqual(["who_am_i:true", "close_dates:false"]);
  });

  it("hands the model money already formatted in its currency", () => {
    const payload = toolPayload({
      ok: true,
      result: {
        currency: "USD",
        nightlyFromCents: 14_000,
        rooms: [{ stayTotalCents: 28_000 }, { stayTotalCents: null }],
      },
    });
    expect(payload).toEqual({
      currency: "USD",
      nightlyFrom: "$140.00",
      rooms: [{ stayTotal: "$280.00" }, { stayTotal: null }],
    });
  });
});
