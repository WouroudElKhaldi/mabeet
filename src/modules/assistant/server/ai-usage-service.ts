import { AI_CALL_CHANNELS, type AiCallChannel } from "@/config/enums";
import { type PlatformActor, requirePlatformAdmin } from "@/server/auth/tenant-context";
import { prisma } from "@/server/db/client";
import { addDays } from "@/utils/dates";
import * as keys from "./api-key-repository";

// How much the AI tools are used across the platform, for the admins: every call a host's AI app, the dashboard chat
// or the public guest MCP made, from the same log the keys page reads.

/** A channel written in the log that is not one of ours today is counted with the host MCP, never dropped. */
const knownChannel = (channel: string): AiCallChannel =>
  AI_CALL_CHANNELS.find((known) => known === channel) ?? "mcp";

interface ToolUsage {
  tool: string;
  channel: AiCallChannel;
  calls: number;
  failed: number;
  /** The average time a call took, in milliseconds. */
  averageMs: number;
}

/** The calls of the last `days` days: the totals, each channel's share, and each tool, most called first. */
export async function getAiUsage(actor: PlatformActor, days: number, now = new Date()) {
  requirePlatformAdmin(actor);
  const since = addDays(now, -days);
  const [counted, failures] = await Promise.all([
    keys.countToolCalls(prisma, since),
    keys.countFailedToolCalls(prisma, since),
  ]);
  const failedOf = new Map(failures.map((row) => [`${row.tool} ${row.channel}`, row._count._all]));
  const tools: ToolUsage[] = counted
    .map((row) => ({
      tool: row.tool,
      channel: knownChannel(row.channel),
      calls: row._count._all,
      failed: failedOf.get(`${row.tool} ${row.channel}`) ?? 0,
      averageMs: Math.round(row._avg.latencyMs ?? 0),
    }))
    .sort((first, second) => second.calls - first.calls || first.tool.localeCompare(second.tool));
  const byChannel = Object.fromEntries(
    AI_CALL_CHANNELS.map((channel) => [
      channel,
      tools.filter((row) => row.channel === channel).reduce((sum, row) => sum + row.calls, 0),
    ]),
  ) as Record<AiCallChannel, number>;
  return {
    days,
    total: tools.reduce((sum, row) => sum + row.calls, 0),
    failed: tools.reduce((sum, row) => sum + row.failed, 0),
    byChannel,
    tools,
  };
}
