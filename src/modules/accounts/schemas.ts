import { z } from "zod";
import { phone } from "@/lib/schemas";

/** Closing an account: the person types their email again to confirm. */
export const accountDeletion = z.object({ email: z.string().max(254) });

/** The person's own name and phone. The email is how they sign in, so it is not changed here. */
export const profileInput = z.object({
  name: z.string().trim().min(2).max(80),
  phone: phone.nullish(),
});
