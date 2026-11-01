import { prisma } from "@/server/db/client";
import { listBookingDeciders } from "./team-repository";

/** The people other modules tell about a place's bookings: everyone on the team who may decide them. */
export function listPeopleWhoDecideBookings(businessId: string) {
  return listBookingDeciders(prisma, businessId);
}
