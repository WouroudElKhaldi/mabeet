import { answerHostMcp, methodNotAllowed } from "@/modules/assistant/server";
import { route } from "@/server/http/route";

/** The owner and staff MCP, with a personal key: read only, as the member the key belongs to. */
export const POST = route(async (request) => answerHostMcp(request));

export const GET = route(async () => methodNotAllowed());
export const DELETE = route(async () => methodNotAllowed());
