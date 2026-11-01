import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TenantContext } from "@/server/auth/tenant-context";

// Sign-in for pages: a signed-out visitor goes to sign in (and comes back), a non-member and a member without the
// permission both get the 404 page, exactly like the API.

const state = vi.hoisted(() => ({
  user: null as null | { id: string; email: string },
  ctx: null as null | TenantContext,
}));

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`redirect:${to}`);
  },
  notFound: () => {
    throw new Error("not-found");
  },
}));
vi.mock("@/server/auth/better-auth", () => ({
  auth: { api: { getSession: async () => (state.user ? { user: state.user } : null) } },
}));
vi.mock("@/server/auth/resolve-context", () => ({ resolveContext: async () => state.ctx }));

const { getCurrentUser, requirePageAccess, requirePageTenant, requirePageUser } =
  await import("@/server/http/session");

const member = (permissions: string[]): TenantContext =>
  ({
    userId: "user_1",
    businessId: "biz_1",
    membershipId: "member_1",
    isOwner: false,
    permissions: new Set(permissions),
    channel: "web",
  }) as TenantContext;

beforeEach(() => {
  state.user = null;
  state.ctx = null;
});

describe("page sign-in", () => {
  it("sends a signed-out visitor to sign in, and back to where they were going", async () => {
    expect(await getCurrentUser()).toBeNull();
    await expect(requirePageUser()).rejects.toThrow("redirect:/sign-in");
    await expect(requirePageUser("/b/abc")).rejects.toThrow(
      `redirect:/sign-in?next=${encodeURIComponent("/b/abc")}`,
    );
  });

  it("gives a signed-in person their account", async () => {
    state.user = { id: "user_1", email: "maya@guesthouse.lb" };
    await expect(requirePageUser()).resolves.toMatchObject({ id: "user_1" });
  });

  it("shows a non-member the 404 page, never the business", async () => {
    state.user = { id: "user_1", email: "maya@guesthouse.lb" };
    await expect(requirePageTenant("biz_not_mine")).rejects.toThrow("not-found");
  });

  it("lets a member in only with one of the permissions the page needs", async () => {
    state.user = { id: "user_1", email: "maya@guesthouse.lb" };
    state.ctx = member(["bookings.read"]);
    await expect(requirePageAccess("biz_1", ["bookings.read", "bookings.decide"])).resolves.toMatchObject({
      businessId: "biz_1",
    });
    await expect(requirePageAccess("biz_1", ["analytics.read"])).rejects.toThrow("not-found");
  });
});
