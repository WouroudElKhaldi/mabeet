import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as pushRoute from "@/app/api/me/push/route";
import { createUser, prisma } from "@tests/integration/helpers";
import { call, signUp } from "@tests/integration/http";
import { resetMemoryRateLimits } from "@/server/http/rate-limit";
import type * as PushSend from "@/server/push/send";
import type { PushDevice, PushMessage } from "@/server/push/send";
import { noticeAsPush, pushToPeople } from "../server";

// Push devices on the real database: one row per browser, owned by whoever turned push on last, and every device of
// the people told gets the message. The push services themselves are faked.

const sent: Array<{ endpoint: string; message: PushMessage }> = [];
const gone = new Set<string>();
const broken = new Set<string>();

vi.mock("@/server/push/send", async (importOriginal) => ({
  ...(await importOriginal<typeof PushSend>()),
  pushEnabled: () => true,
  sendPush: async (device: PushDevice, message: PushMessage) => {
    if (broken.has(device.endpoint)) throw new Error("push service down");
    if (gone.has(device.endpoint)) return false;
    sent.push({ endpoint: device.endpoint, message });
    return true;
  },
}));

const endpoint = () => `https://fcm.googleapis.com/fcm/send/${randomUUID()}`;
const device = (address: string) => ({
  endpoint: address,
  keys: { p256dh: "p256dh-key", auth: "auth-secret" },
});

describe("turning push on and off", () => {
  beforeEach(resetMemoryRateLimits);

  it("saves the signed-in person's device, once per browser", async () => {
    const guest = await signUp("Maya Haddad");
    const address = endpoint();
    expect(await call(pushRoute.POST, { as: guest, body: device(address) })).toEqual({
      status: 200,
      body: { ok: true },
    });
    await call(pushRoute.POST, {
      as: guest,
      body: { ...device(address), keys: { p256dh: "new", auth: "new" } },
    });
    expect(await prisma.pushSubscription.findMany({ where: { endpoint: address } })).toEqual([
      expect.objectContaining({ userId: guest.userId, p256dh: "new" }),
    ]);
  });

  it("gives the browser to whoever turns push on there last, and lets only its owner turn it off", async () => {
    const first = await signUp("First");
    const second = await signUp("Second");
    const address = endpoint();
    await call(pushRoute.POST, { as: first, body: device(address) });
    await call(pushRoute.POST, { as: second, body: device(address) });
    expect(await prisma.pushSubscription.findUnique({ where: { endpoint: address } })).toMatchObject({
      userId: second.userId,
    });

    await call(pushRoute.DELETE, { as: first, method: "DELETE", body: { endpoint: address } });
    expect(await prisma.pushSubscription.count({ where: { endpoint: address } })).toBe(1);
    await call(pushRoute.DELETE, { as: second, method: "DELETE", body: { endpoint: address } });
    expect(await prisma.pushSubscription.count({ where: { endpoint: address } })).toBe(0);
  });

  it("needs a sign-in and a real push service", async () => {
    expect((await call(pushRoute.POST, { body: device(endpoint()) })).status).toBe(401);
    const guest = await signUp("Guest");
    expect(
      (await call(pushRoute.POST, { as: guest, body: device("https://attacker.example/x") })).status,
    ).toBe(400);
  });
});

describe("pushing to people", () => {
  it("reaches every device of the people told, in each person's words, and forgets gone devices", async () => {
    const maya = await createUser("Maya");
    const omar = await createUser("Omar");
    const [mayaPhone, mayaLaptop, omarPhone, omarOld] = [endpoint(), endpoint(), endpoint(), endpoint()];
    for (const [userId, address] of [
      [maya.id, mayaPhone],
      [maya.id, mayaLaptop],
      [omar.id, omarPhone],
      [omar.id, omarOld],
    ] as const) {
      await prisma.pushSubscription.create({ data: { userId, endpoint: address, p256dh: "k", auth: "a" } });
    }
    gone.add(omarOld);

    await pushToPeople([maya.id, omar.id], (userId) => ({
      title: userId === maya.id ? "Hello Maya" : "Hello Omar",
      body: "",
      url: "/",
    }));

    const to = (address: string) => sent.find((push) => push.endpoint === address)?.message.title;
    expect([to(mayaPhone), to(mayaLaptop), to(omarPhone)]).toEqual([
      "Hello Maya",
      "Hello Maya",
      "Hello Omar",
    ]);
    expect(await prisma.pushSubscription.count({ where: { endpoint: omarOld } })).toBe(0);
  });

  it("never throws, and skips closed accounts", async () => {
    const closed = await createUser("Closed");
    await prisma.user.update({ where: { id: closed.id }, data: { isDeleted: true } });
    const closedPhone = endpoint();
    await prisma.pushSubscription.create({
      data: { userId: closed.id, endpoint: closedPhone, p256dh: "k", auth: "a" },
    });
    const down = await createUser("Down");
    const downPhone = endpoint();
    await prisma.pushSubscription.create({
      data: { userId: down.id, endpoint: downPhone, p256dh: "k", auth: "a" },
    });
    broken.add(downPhone);
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(
      pushToPeople([closed.id, down.id], () => ({ title: "Hi", body: "", url: "/" })),
    ).resolves.toBeUndefined();
    expect(sent.some((push) => push.endpoint === closedPhone)).toBe(false);
    expect(await prisma.pushSubscription.count({ where: { endpoint: downPhone } })).toBe(1);
    expect(errors).toHaveBeenCalled();
    errors.mockRestore();
  });
});

describe("a notice as a push", () => {
  it("takes the title, the first line and the page the button opens", () => {
    expect(
      noticeAsPush({
        kicker: "Booking request",
        title: "New request for Beit Ghazir",
        body: ["Maya asks for two nights.", "Answer within 24 hours."],
        action: { label: "Open", url: "https://mabeet.app/dashboard/b1/bookings" },
      }),
    ).toEqual({
      title: "New request for Beit Ghazir",
      body: "Maya asks for two nights.",
      url: "https://mabeet.app/dashboard/b1/bookings",
    });
  });

  it("falls back to the kicker and the home page", () => {
    expect(noticeAsPush({ kicker: "Team", title: "Hello", body: [] })).toMatchObject({
      body: "Team",
      url: expect.stringMatching(/\/$/),
    });
  });
});
