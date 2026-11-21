import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { ElicitRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { answerInSession } from "../server/mcp-sessions";
import { defineTool } from "../server/tool";

// The pop-up an AI app shows the person before a change: our server asks for it in the middle of the tool call, in
// the app's own window, so the model cannot answer for the person. Only an app that says it can show one is asked.

const changes: string[] = [];

const TOOLS = [
  defineTool({
    name: "close_dates",
    description: "Changes data after asking the person.",
    input: z.object({ nights: z.string().max(20) }),
    mutates: true,
    run: async ({ nights }, _context: unknown, ask) => {
      if ((await ask?.(`Close ${nights}?`)) === "no") return "not closed";
      changes.push(nights);
      return "closed";
    },
  }),
];

/** A real MCP client whose requests reach our session handler, as one key's owner. */
async function connect(answer: "accept" | "decline" | null, owner = "key-1") {
  const transport = new StreamableHTTPClientTransport(new URL("http://localhost/api/mcp"), {
    fetch: (input, init) =>
      answerInSession(new Request(input, init), owner, {
        name: "test",
        instructions: "Testing.",
        tools: TOOLS,
        context: null,
      }),
  });
  const client = new Client(
    { name: "test-app", version: "1.0.0" },
    { capabilities: answer ? { elicitation: {} } : {} },
  );
  const asked: string[] = [];
  if (answer) {
    client.setRequestHandler(ElicitRequestSchema, (request) => {
      asked.push(request.params.message);
      return { action: answer, content: {} };
    });
  }
  await client.connect(transport);
  return { client, transport, asked };
}

const textOf = (result: Awaited<ReturnType<Client["callTool"]>>) =>
  (result.content as Array<{ text: string }>)[0]?.text;

describe("the pop-up before a change", () => {
  it("shows the person the question, and makes the change only when they press yes", async () => {
    const yes = await connect("accept");
    expect(
      textOf(await yes.client.callTool({ name: "close_dates", arguments: { nights: "3–15 Dec" } })),
    ).toBe('"closed"');
    expect(yes.asked).toEqual(["Close 3–15 Dec?"]);
    expect(changes).toContain("3–15 Dec");
    await yes.client.close();

    const no = await connect("decline");
    expect(textOf(await no.client.callTool({ name: "close_dates", arguments: { nights: "1–2 Jan" } }))).toBe(
      '"not closed"',
    );
    expect(changes).not.toContain("1–2 Jan");
    await no.client.close();
  });

  it("asks nothing of an app that cannot show a pop-up", async () => {
    const plain = await connect(null);
    expect(textOf(await plain.client.callTool({ name: "close_dates", arguments: { nights: "5 Feb" } }))).toBe(
      '"closed"',
    );
    await plain.client.close();
  });

  it("keeps each session to the caller who started it", async () => {
    const mine = await connect(null, "key-1");
    const sessionId = mine.transport.sessionId;
    expect(sessionId).toBeTruthy();
    const response = await answerInSession(
      new Request("http://localhost/api/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          "mcp-session-id": sessionId ?? "",
        },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
      }),
      "key-2",
      { name: "test", instructions: "Testing.", tools: TOOLS, context: null },
    );
    expect(response.status).toBe(404);
    await mine.client.close();
  });
});
