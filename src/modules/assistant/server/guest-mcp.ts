import { toIsoDate } from "@/utils/dates";
import { toolCallRecorder } from "./api-key-service";
import { GUEST_TOOLS } from "./guest-tools";
import { handleMcpRequest } from "./mcp-server";

/**
 * The public guest MCP: anyone can add it to Claude or ChatGPT, with no sign-in. Read only, listed places only, and
 * it never books: every answer links to the place's page. Each call is logged without a place, for the platform's
 * AI usage page.
 */
export function answerGuestMcp(request: Request, now = new Date()): Promise<Response> {
  return handleMcpRequest(request, {
    name: "guest",
    instructions: `Find Lebanese guesthouses that book direct, free on the guest's dates. Today is ${toIsoDate(now)}. Prices come already formatted in each place's currency. Only suggest places the tools return, with their booking link: you cannot book for the guest, and an empty search means nothing matches.`,
    tools: GUEST_TOOLS,
    context: null,
    // Logged with no place and no person, so the admins can see how much guests use it.
    onCall: toolCallRecorder({ channel: "guest" }),
  });
}
