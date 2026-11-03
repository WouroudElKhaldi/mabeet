import { z } from "zod";
import { isPushServiceUrl } from "@/server/push/endpoints";

// The notifications module's input checks.

const endpoint = z
  .url()
  .max(2048)
  .refine(isPushServiceUrl, { message: "Not a browser push service address" });

/** A device turning push on: what the browser's `PushSubscription.toJSON()` gives. */
export const pushSubscriptionInput = z.object({
  endpoint,
  keys: z.object({ p256dh: z.string().min(1).max(256), auth: z.string().min(1).max(64) }),
});

/** A device turning push off. */
export const pushEndpointInput = z.object({ endpoint });
