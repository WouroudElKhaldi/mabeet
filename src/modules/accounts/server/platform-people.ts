import { type PlatformActor, requirePlatformAdmin } from "@/server/auth/tenant-context";
import { prisma } from "@/server/db/client";
import { countPeople, listNewestPeople } from "./account-repository";

/** How many accounts the admin's list shows: the newest ones. */
const PEOPLE_SHOWN = 100;

/** Everyone with an account, for the platform admin: how many in all, and the newest. */
export async function listPlatformPeople(actor: PlatformActor) {
  requirePlatformAdmin(actor);
  const [total, people] = await Promise.all([countPeople(prisma), listNewestPeople(prisma, PEOPLE_SHOWN)]);
  return {
    total,
    people: people.map(({ _count, ...person }) => ({
      ...person,
      placeCount: _count.memberships,
      tripCount: _count.bookings,
    })),
  };
}
