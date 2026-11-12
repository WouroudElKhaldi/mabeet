import { z } from "zod";
import { AI_USAGE_PERIODS } from "@/config/enums";
import { id, listChoice, workspaceParams } from "@/lib/schemas";

// The assistant module's input checks.

/**
 * A new MCP key: a name to know it by, how long it lasts (90 days unless the person chooses; null never ends), and
 * whether it may change things (read only unless asked).
 */
export const keyInput = z.object({
  name: z.string().trim().min(2).max(60),
  expiresInDays: z.number().int().min(1).max(365).nullable().default(90),
  canWrite: z.boolean().default(false),
});

/** /api/workspaces/{businessId}/keys/{keyId} */
export const keyParams = workspaceParams.extend({ keyId: id });

/** The place picked while connecting an AI app by signing in. */
export const workspaceChoice = z.object({ businessId: id });

/** /api/workspaces/{businessId}/connected-apps/{connectionId} */
export const connectionParams = workspaceParams.extend({ connectionId: id });

/** The platform's AI usage page's address: the period, the last 30 days unless another is picked. */
export const aiUsageQuery = z.object({ days: listChoice(AI_USAGE_PERIODS) });
