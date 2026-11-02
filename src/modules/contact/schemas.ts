import { z } from "zod";
import { CONTACT_TOPICS } from "@/config/contact";

/** A message to the Mabeet team from the Contact page. The email is where the team replies. */
export const contactMessage = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.email().max(254),
  topic: z.enum(CONTACT_TOPICS),
  message: z.string().trim().min(10).max(2000),
});
