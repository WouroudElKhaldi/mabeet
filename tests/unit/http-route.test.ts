import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const getSession = vi.hoisted(() => vi.fn());

vi.mock("@/server/env", () => ({
  env: { BETTER_AUTH_URL: "https://mabeet.app", CRON_SECRET: "cron-secret-cron-secret-cron" },
}));
vi.mock("@/server/auth/better-auth", () => ({ auth: { api: { getSession } } }));

const { json, parseBody, parseParams, optionalUser, parseQuery, requireCronSecret, requireUser, route } =
  await import("@/server/http/route");
const { AppError, conflict, forbidden, invalid, notFound, unauthenticated, unavailable } =
  await import("@/server/errors");

const context = { params: Promise.resolve({ slug: "beit-batroun" }) };

const call = (handler: () => Promise<Response>, init: RequestInit = {}) =>
  route(handler)(new Request("https://mabeet.app/api/test", init), context);

const errorOf = async (response: Response) =>
  ((await response.json()) as { error: { code: string; message: string } }).error;

afterEach(() => {
  vi.restoreAllMocks();
  getSession.mockReset();
});

describe("route", () => {
  it("turns each kind of error into its HTTP status, with the message people read", async () => {
    const cases = [
      [notFound("Room"), 404, "Room not found"],
      [forbidden(), 403, "You do not have permission to do this"],
      [conflict("Those dates were just taken"), 409, "Those dates were just taken"],
      [unauthenticated(), 401, "Sign in required"],
      [unavailable("Payments are down"), 503, "Payments are down"],
      [invalid("Pick a room"), 400, "Pick a room"],
    ] as const;
    for (const [error, status, message] of cases) {
      const response = await call(async () => {
        throw error;
      });
      expect(response.status).toBe(status);
      expect((await errorOf(response)).message).toBe(message);
    }
  });

  it("tells a rate-limited caller when to try again", async () => {
    const response = await call(async () => {
      throw new AppError("RATE_LIMITED", "Too many requests. Please slow down.", { retryAfterSeconds: 42 });
    });
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("42");
  });

  it("answers wrong input with 400 and the fields that are wrong", async () => {
    const response = await call(async () => json(z.object({ guests: z.number() }).parse({ guests: "two" })));
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: { code: string; details: { fieldErrors: object } } };
    expect(body.error.code).toBe("VALIDATION");
    expect(body.error.details.fieldErrors).toHaveProperty("guests");
  });

  it("never shows an unexpected error's details, and logs it instead", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = await call(async () => {
      throw new Error("connection string postgres://secret");
    });
    expect(response.status).toBe(500);
    expect(await errorOf(response)).toEqual({ code: "INTERNAL", message: "Something went wrong" });
    expect(logged).toHaveBeenCalled();
  });

  it("refuses a write sent from another website, and lets our own site and reads through", async () => {
    const handler = async () => json({ ok: true });
    expect(
      (await call(handler, { method: "POST", headers: { origin: "https://evil.example" } })).status,
    ).toBe(403);
    expect((await call(handler, { method: "POST", headers: { origin: "https://mabeet.app" } })).status).toBe(
      200,
    );
    expect((await call(handler, { headers: { origin: "https://evil.example" } })).status).toBe(200);
  });
});

describe("reading input", () => {
  it("refuses a body that is not JSON with a clear 400", async () => {
    const request = new Request("https://mabeet.app/api/test", { method: "POST", body: "guests=2" });
    await expect(parseBody(request, z.object({}))).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("checks the query and the URL parts with their schema", async () => {
    const request = new Request("https://mabeet.app/api/test?guests=2");
    expect(parseQuery(request, z.object({ guests: z.coerce.number() }))).toEqual({ guests: 2 });
    await expect(parseParams(context, z.object({ slug: z.string() }))).resolves.toEqual({
      slug: "beit-batroun",
    });
  });
});

describe("who is calling", () => {
  it("treats a visitor with no session as signed out, and asks them to sign in where it matters", async () => {
    getSession.mockResolvedValue(null);
    await expect(optionalUser(new Request("https://mabeet.app/api/test"))).resolves.toBeNull();
    await expect(requireUser(new Request("https://mabeet.app/api/test"))).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
    });
  });

  it("returns the signed-in user", async () => {
    getSession.mockResolvedValue({ user: { id: "u1" } });
    await expect(requireUser(new Request("https://mabeet.app/api/test"))).resolves.toEqual({ id: "u1" });
  });

  it("lets a scheduled job in only with the exact secret", () => {
    const withSecret = (value: string) =>
      new Request("https://mabeet.app/api/cron/expire-holds", { headers: { authorization: value } });
    expect(() => requireCronSecret(withSecret("Bearer cron-secret-cron-secret-cron"))).not.toThrow();
    expect(() => requireCronSecret(withSecret("Bearer cron-secret-cron-secret-crox"))).toThrow();
    expect(() => requireCronSecret(withSecret("Bearer short"))).toThrow();
  });
});
