import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import * as guestMcpRoute from "@/app/api/mcp/guest/route";
import { settleBackgroundWork } from "@/server/background";
import { resetMemoryRateLimits } from "@/server/http/rate-limit";
import { addDays } from "@/utils/dates";
import { createPlace, createPlatformAdmin, prisma } from "@tests/integration/helpers";
import { getAiUsage } from "../server";

// The platform's AI usage on the real database: every call is counted by tool and channel, failures and time
// included, only inside the period; and a call to the public guest MCP is logged with no place, so it counts too.
// The test database keeps earlier runs' calls, so each test counts tools named for this run only.

const ownTool = (name: string) => `${name}_${randomUUID().slice(0, 8)}`;

describe("the platform's AI usage", () => {
  beforeEach(resetMemoryRateLimits);

  it("counts each tool's calls by channel, with its failures and average time, inside the period", async () => {
    const admin = await createPlatformAdmin();
    const { business, owner } = await createPlace("Beit Usage");
    const report = ownTool("get_report");
    const search = ownTool("search_places");
    const now = new Date();
    await prisma.mcpAuditLog.createMany({
      data: [
        {
          businessId: business.id,
          userId: owner.id,
          channel: "mcp",
          tool: report,
          outcome: "ok",
          latencyMs: 100,
        },
        {
          businessId: business.id,
          userId: owner.id,
          channel: "mcp",
          tool: report,
          outcome: "ok",
          latencyMs: 300,
        },
        {
          businessId: business.id,
          userId: owner.id,
          channel: "mcp",
          tool: report,
          outcome: "Missing permission",
          latencyMs: 200,
        },
        {
          businessId: business.id,
          userId: owner.id,
          channel: "chat",
          tool: report,
          outcome: "ok",
          latencyMs: 50,
        },
        { channel: "guest", tool: search, outcome: "ok", latencyMs: 400 },
        // Older than the period: left out.
        { channel: "guest", tool: search, outcome: "ok", latencyMs: 400, createdAt: addDays(now, -10) },
      ],
    });

    const usage = await getAiUsage(admin, 7, now);
    const mine = usage.tools.filter((row) => row.tool === report || row.tool === search);

    expect(mine).toEqual(
      expect.arrayContaining([
        { tool: report, channel: "mcp", calls: 3, failed: 1, averageMs: 200 },
        { tool: report, channel: "chat", calls: 1, failed: 0, averageMs: 50 },
        { tool: search, channel: "guest", calls: 1, failed: 0, averageMs: 400 },
      ]),
    );
    expect(mine).toHaveLength(3);
    expect(usage.total).toBe(usage.tools.reduce((sum, row) => sum + row.calls, 0));
    expect(usage.byChannel.mcp + usage.byChannel.chat + usage.byChannel.guest).toBe(usage.total);
    // Most called first.
    const calls = usage.tools.map((row) => row.calls);
    expect(calls).toEqual([...calls].sort((first, second) => second - first));
  });

  it("logs a call to the guest MCP with no place and no person", async () => {
    const before = new Date();
    const response = await guestMcpRoute.POST(
      new Request("http://localhost/api/mcp/guest", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          "x-forwarded-for": "203.0.113.41",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: {
            name: "search_places",
            arguments: { area: `Nowhere ${randomUUID().slice(0, 8)}`, guests: 1 },
          },
        }),
      }),
      { params: Promise.resolve({}) },
    );
    expect(response.status).toBe(200);
    await settleBackgroundWork();

    const logged = await prisma.mcpAuditLog.findMany({
      where: { channel: "guest", tool: "search_places", createdAt: { gte: before } },
    });
    expect(logged.length).toBeGreaterThanOrEqual(1);
    expect(logged.every((row) => row.businessId === null && row.userId === null)).toBe(true);
  });
});
