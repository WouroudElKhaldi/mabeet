import { z } from "zod";

/** Closing an account: the person types their email again to confirm. */
export const accountDeletion = z.object({ email: z.string().max(254) });
