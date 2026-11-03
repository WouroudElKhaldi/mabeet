import { z } from "zod";
import { id, workspaceParams } from "@/lib/schemas";

// The assistant module's input checks.

/** A new MCP key: a name to know it by, and how long it lasts (90 days unless the person chooses; null never ends). */
export const keyInput = z.object({
  name: z.string().trim().min(2).max(60),
  expiresInDays: z.number().int().min(1).max(365).nullable().default(90),
});

/** /api/workspaces/{businessId}/keys/{keyId} */
export const keyParams = workspaceParams.extend({ keyId: id });
