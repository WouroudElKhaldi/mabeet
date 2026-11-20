import { answerHostMcp } from "@/modules/assistant/server";
import { route } from "@/server/http/route";

/**
 * The owner and staff MCP, with a personal key or a signed-in AI app, as the member it belongs to. GET and DELETE
 * reach an open session (its stream, or its end); outside one they are refused.
 */
export const POST = route(async (request) => answerHostMcp(request));
export const GET = route(async (request) => answerHostMcp(request));
export const DELETE = route(async (request) => answerHostMcp(request));
