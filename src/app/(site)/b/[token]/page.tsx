import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { bookingTokenParams } from "@/modules/bookings";
import {
  getBookingForGuest,
  getSessionBookingForGuest,
  onlinePaymentMethods,
  refreshGuestPayments,
} from "@/modules/bookings/server";
import { BookingView } from "@/modules/directory";
import { listNearStay, listOfferingsNearStay } from "@/modules/directory/server";
import { OFFERINGS_SHOWN } from "@/config/listing";
import { pushPublicKey } from "@/modules/notifications/server";
import { requirePageUser } from "@/server/http/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("confirmation");
  return { title: t("title") };
}

/**
 * The guest's own booking, a stay or seats in a session, at the private link they were sent to after booking. It asks the server again while it
 * waits for the payment or the host, so the guest sees the change without reloading. Someone else's link is "not
 * found", like an unknown one.
 */
export default async function BookingPage({ params }: { params: Promise<{ token: string }> }) {
  const parsed = bookingTokenParams.safeParse(await params);
  if (!parsed.success) notFound();
  const { token } = parsed.data;
  const user = await requirePageUser(`/b/${encodeURIComponent(token)}`);

  // A link is a stay's or seats': both are long random secrets, so the stay is looked for first and then the seats.
  const read = async () =>
    (await getBookingForGuest(token, user.id)) ?? (await getSessionBookingForGuest(token, user.id));
  let booking = await read();
  if (!booking) notFound();
  // Back from the payment page before the confirmation reached us: ask the payment service now, not at the next tick.
  if (booking.status === "AWAITING_PAYMENT") {
    await refreshGuestPayments(token, user.id);
    booking = (await read()) ?? booking;
  }
  return (
    <BookingView
      token={token}
      booking={booking}
      methods={onlinePaymentMethods(booking.currency)}
      nearby={await listNearStay(booking.business.slug)}
      thingsToDo={
        OFFERINGS_SHOWN && "checkIn" in booking
          ? await listOfferingsNearStay(booking.business.slug, {
              checkIn: booking.checkIn,
              checkOut: booking.checkOut,
            })
          : []
      }
      pushKey={pushPublicKey()}
    />
  );
}
