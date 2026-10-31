import { z } from "zod";
import { phone } from "@/lib/schemas";

/** Creating a place: the person who creates it becomes its owner. */
export const workspaceInput = z.object({
  name: z.string().trim().min(2).max(80),
  area: z.string().trim().max(80).optional(),
  phone: phone.optional(),
});
