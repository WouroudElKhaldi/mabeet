import { prisma } from "@/server/db/client";
import { appUrl } from "@/server/email/notices";
import { env } from "@/server/env";
import type { Message } from "@/server/email/templates";
import { type PushDevice, type PushMessage, pushEnabled, sendPush } from "@/server/push/send";
import * as devices from "./push-repository";

// Push notifications follow the emails: whoever is emailed about something also gets it on every device they turned
// push on. Each module's notify job pushes after its email has gone, through `pushToPeople`, which never throws: a
// push outage must not make the job send its email again.

/** The key browsers need to turn push on, or null when push is not set up on this server. */
export const pushPublicKey = (): string | null => (pushEnabled() ? (env.VAPID_PUBLIC_KEY ?? null) : null);

/** Turns push on for this device, for the signed-in person. */
export function followOnDevice(userId: string, device: PushDevice): Promise<void> {
  return devices.saveDevice(prisma, userId, device);
}

/** Turns push off for this device. */
export function unfollowDevice(userId: string, endpoint: string): Promise<void> {
  return devices.deleteDevice(prisma, userId, endpoint);
}

/** An email's message as a notification: its title, its first line, and the page its button opens. */
export function noticeAsPush(message: Message): PushMessage {
  return {
    title: message.title,
    body: message.body[0] ?? message.kicker,
    url: message.action?.url ?? appUrl("/"),
  };
}

/**
 * Pushes to every device of these people, each given the message `messageFor` writes for its owner. Devices their
 * push service says are gone are forgotten. Never throws: a failure is logged.
 */
export async function pushToPeople(
  userIds: readonly string[],
  messageFor: (userId: string) => PushMessage,
): Promise<void> {
  if (!pushEnabled() || userIds.length === 0) return;
  try {
    const targets = await devices.listDevices(prisma, userIds);
    const results = await Promise.allSettled(
      targets.map((device) => sendPush(device, messageFor(device.userId))),
    );
    const gone = targets.filter((_, index) => {
      const result = results[index];
      if (result?.status === "rejected") console.error("[push] delivery failed", result.reason);
      return result?.status === "fulfilled" && !result.value;
    });
    if (gone.length > 0) {
      await devices.deleteDevices(
        prisma,
        gone.map((device) => device.id),
      );
    }
  } catch (error) {
    console.error("[push] could not push", error);
  }
}
