import { answerGuestMcp, methodNotAllowed } from "@/modules/assistant/server";
import { route } from "@/server/http/route";
import { clientAddress, enforceRateLimit } from "@/server/http/rate-limit";

const CALLS_PER_MINUTE = 30;

/** The public guest MCP (no sign-in): search places, check dates and prices, read a place. Read only; never books. */
export const POST = route(async (request) => {
  await enforceRateLimit(`mcp-guest:${clientAddress(request)}`, CALLS_PER_MINUTE, 60_000);
  return answerGuestMcp(request);
});

export const GET = route(async () => methodNotAllowed());
export const DELETE = route(async () => methodNotAllowed());
