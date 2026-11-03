import { randomUUID } from "node:crypto";
import type { RoomKind } from "@prisma/client";
import { toPermissions, type Permission } from "@/config/permissions";
import { createWorkspace } from "@/modules/workspaces/server";
import { resolveContext } from "@/server/auth/resolve-context";
import type { TenantContext } from "@/server/auth/tenant-context";
import { prisma } from "@/server/db/client";
import { addDays, type DateRange, todayUtc } from "@/utils/dates";

// Every helper makes new rows with unique names and ids, so tests never need an empty database and never delete
// anything (04-test-plan.md, "Integration tests").

export { prisma };

/** A unique email on a reserved test domain, so no email is ever sent to it. */
export const testEmail = () => `${randomUUID()}@example.test`;

export function createUser(name = "Test User") {
  return prisma.user.create({ data: { id: randomUUID(), name, email: testEmail() } });
}

async function contextOf(userId: string, businessId: string): Promise<TenantContext> {
  const ctx = await resolveContext(userId, businessId);
  if (!ctx) throw new Error("expected an active membership");
  return ctx;
}

/** A new workspace and its owner's context. */
export async function createPlace(name = "Beit Test") {
  const owner = await createUser(`${name} owner`);
  const business = await createWorkspace(owner.id, { name });
  return { owner, business, ctx: await contextOf(owner.id, business.id) };
}

/** A room in a place, written straight to the database: booking tests need rooms, not the rooms screens. */
export function addRoom(
  businessId: string,
  room: Partial<{ capacity: number; minNights: number; baseRateCents: number; kind: RoomKind }> = {},
) {
  return prisma.room.create({
    data: {
      businessId,
      name: `Room ${randomUUID().slice(0, 8)}`,
      baseRateCents: 9_000,
      exportToken: randomUUID(),
      ...room,
    },
  });
}

/** A stay starting `fromToday` days after today, for `nights` nights. */
export function stay(fromToday: number, nights: number, now = new Date()): DateRange {
  const checkIn = addDays(todayUtc(now), fromToday);
  return { checkIn, checkOut: addDays(checkIn, nights) };
}

/** Adds a new user to a workspace on a custom role with exactly these permissions. */
export async function memberWith(businessId: string, permissions: Permission[]): Promise<TenantContext> {
  const user = await createUser("Staff");
  const role = await prisma.role.create({
    data: { businessId, name: `role-${randomUUID()}`, permissions: [...toPermissions(permissions)] },
  });
  await prisma.membership.create({ data: { userId: user.id, businessId, roleId: role.id } });
  return contextOf(user.id, businessId);
}
