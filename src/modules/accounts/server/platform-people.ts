import { type PlatformActor, requirePlatformAdmin } from "@/server/auth/tenant-context";
import { prisma } from "@/server/db/client";
import { notFound } from "@/server/errors";
import { pageOf } from "@/utils/paging";
import {
  countPeople,
  findPersonForAdmin,
  listPeopleForAdmin,
  type PeopleFilters,
} from "./account-repository";

/**
 * Everyone with an account, for the platform admin's table: one page, the newest first, searched by name, email or
 * phone and filtered by kind, with how many in all. With no filters it is everyone, for the overview's count.
 */
export async function listPlatformPeople(actor: PlatformActor, filters: PeopleFilters = { q: "" }, page = 1) {
  requirePlatformAdmin(actor);
  const total = await countPeople(prisma, filters);
  const { skip, take, ...paging } = pageOf(total, page);
  const people = await listPeopleForAdmin(prisma, filters, { skip, take });
  return {
    total,
    ...paging,
    people: people.map(({ _count, memberships, ...person }) => ({
      ...person,
      placeCount: memberships.length,
      ownsPlace: memberships.some((membership) => membership.role.isOwner),
      tripCount: _count.bookings,
    })),
  };
}

/** One person for the admin: their account, the places they work in and their role there, and their counts. */
export async function getPlatformPerson(actor: PlatformActor, userId: string) {
  requirePlatformAdmin(actor);
  const person = await findPersonForAdmin(prisma, userId);
  if (!person) throw notFound("Person");
  const { _count, memberships, ...account } = person;
  return {
    ...account,
    tripCount: _count.bookings,
    reviewCount: _count.reviews,
    places: memberships.map(({ business, role, createdAt }) => ({
      ...business,
      roleName: role.name,
      isOwner: role.isOwner,
      joinedAt: createdAt,
    })),
  };
}
