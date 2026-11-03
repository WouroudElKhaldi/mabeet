import webpush from "web-push";
import { env } from "@/server/env";

// Sends one push notification through the browser maker's push service, signed with our VAPID keys. Which people
// get which message is the notifications module's; this only delivers.

/** What a notification shows, and the page a tap opens. */
export interface PushMessage {
  title: string;
  body: string;
  url: string;
}

/** A device's push address and the keys its browser gave us to encrypt for it. */
export interface PushDevice {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** Push needs both VAPID keys; without them nothing is sent and the screens offer no switch. */
export const pushEnabled = () => Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);

/** A device that unsubscribed or expired: its push service answers "gone". */
const GONE = new Set([404, 410]);
const ONE_DAY_SECONDS = 24 * 60 * 60;

/** Sends one message. Resolves false when the device is gone and should be forgotten. */
export async function sendPush(device: PushDevice, message: PushMessage): Promise<boolean> {
  try {
    await webpush.sendNotification(
      { endpoint: device.endpoint, keys: { p256dh: device.p256dh, auth: device.auth } },
      JSON.stringify(message),
      {
        TTL: ONE_DAY_SECONDS,
        vapidDetails: {
          subject: env.VAPID_SUBJECT,
          publicKey: env.VAPID_PUBLIC_KEY ?? "",
          privateKey: env.VAPID_PRIVATE_KEY ?? "",
        },
      },
    );
    return true;
  } catch (error) {
    if (GONE.has((error as { statusCode?: number }).statusCode ?? 0)) return false;
    throw error;
  }
}
