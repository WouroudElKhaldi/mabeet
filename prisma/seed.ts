/**
 * Demo data, for your computer and the live demo. Every place is fictional and named "(demo)"; its photos are stock
 * pictures, labelled as such, and its numbers are placeholders. Run with `pnpm db:seed`. Safe to run again: anything
 * that exists is left as it is.
 *
 * It makes the platform categories, four demo accounts (host, front-desk staff, guest, admin; password SEED_PASSWORD),
 * and five places that show every way to take bookings: online with the host's approval (the one shown on stage),
 * automatic, offline, and one booked as a whole. The offline place starts with a request waiting for the host and a
 * confirmed stay, so the bookings screen has something to show, and a stay the demo guest has already made and
 * reviewed, so the place page and the host's reviews page have a review to show. Nine partner places sit in the demo places' regions,
 * three of them sponsored, for "Things to do near your stay".
 */
import { config } from "dotenv";
import type { AMENITIES } from "../src/config/amenities";

const CATEGORIES = [
  { slug: "mountain", nameEn: "Mountain", nameAr: "جبل", icon: "mountain" },
  { slug: "beach", nameEn: "By the sea", nameAr: "على البحر", icon: "beach" },
  { slug: "countryside", nameEn: "Countryside", nameAr: "ريف", icon: "countryside" },
  { slug: "old-town", nameEn: "Old town", nameAr: "بلدة قديمة", icon: "old-town" },
  { slug: "guesthouse", nameEn: "Guesthouse", nameAr: "بيت ضيافة", icon: "guesthouse" },
  { slug: "cabin", nameEn: "Cabin", nameAr: "كوخ", icon: "cabin" },
  { slug: "vineyard", nameEn: "Vineyard", nameAr: "كرم", icon: "vineyard" },
  { slug: "ski", nameEn: "Ski", nameAr: "تزلّج", icon: "ski" },
] as const;

type Amenity = (typeof AMENITIES)[number];

interface DemoRoom {
  name: string;
  description: string;
  capacity: number;
  beds: number;
  bedrooms?: number;
  bathrooms?: number;
  /** Per night, in cents. */
  rate: number;
  amenities: Amenity[];
}

interface DemoPlace {
  name: string;
  area: string;
  /** Roughly where the area is, so a guest sees how far the partners near it are. */
  pin: { latitude: number; longitude: number };
  description: string;
  categories: Array<(typeof CATEGORIES)[number]["slug"]>;
  bookingMode: "AUTOMATIC" | "ONLINE_APPROVAL" | "OFFLINE";
  /** Booked as one whole unit, which takes turns with its rooms. */
  wholePlace?: boolean;
  /** Unsplash photo ids: stock photos, labelled as such, not the real place. */
  photos: string[];
  rooms: DemoRoom[];
}

const PLACES: DemoPlace[] = [
  {
    name: "Dar Al Sindiyan (demo)",
    area: "Chouf",
    pin: { latitude: 33.695, longitude: 35.564 },
    description:
      "A restored 19th-century stone house under oak trees, ten minutes from the cedar reserve. Breakfast is made from the garden.\n\nDemo listing.",
    categories: ["mountain", "guesthouse"],
    bookingMode: "ONLINE_APPROVAL",
    photos: [
      "1499696010180-025ef6e1a8f9",
      "1505693416388-ac5ce068fe85",
      "1464822759023-fed622ff2c3b",
      "1522708323590-d24dbb6b0267",
      "1544984243-ec57ea16fe25",
    ],
    rooms: [
      {
        name: "Arched room",
        description: "Vaulted ceiling, a window on the valley.",
        capacity: 2,
        beds: 1,
        rate: 9_500,
        amenities: ["wifi", "breakfast", "heating", "view"],
      },
      {
        name: "Family loft",
        description: "Two levels and a small kitchen.",
        capacity: 4,
        beds: 3,
        rate: 14_000,
        amenities: ["wifi", "breakfast", "heating", "kitchen"],
      },
    ],
  },
  {
    name: "Bayt El Bahr (demo)",
    area: "Batroun",
    pin: { latitude: 34.256, longitude: 35.6575 },
    description:
      "Rooms facing the old harbour, a rooftop for sunsets and the souk around the corner.\n\nDemo listing.",
    categories: ["beach", "old-town"],
    bookingMode: "AUTOMATIC",
    photos: [
      "1520250497591-112f2f40a3f4",
      "1582719478250-c89cae4dc85b",
      "1571896349842-33c89424de2d",
      "1590490360182-c33d57733427",
      "1501785888041-af3ef285b470",
    ],
    rooms: [
      {
        name: "Sea room",
        description: "A balcony over the water.",
        capacity: 2,
        beds: 1,
        rate: 12_000,
        amenities: ["wifi", "ac", "view", "generator"],
      },
      {
        name: "Courtyard room",
        description: "Quiet, opening on the lemon tree.",
        capacity: 3,
        beds: 2,
        rate: 9_000,
        amenities: ["wifi", "ac", "generator"],
      },
    ],
  },
  {
    name: "Beit Ghazir (demo)",
    area: "Ehden",
    pin: { latitude: 34.291, longitude: 35.995 },
    description:
      "A family guesthouse on the main square, known for its mezze breakfast and hiking maps.\n\nDemo listing.",
    categories: ["mountain", "guesthouse", "old-town"],
    bookingMode: "OFFLINE",
    photos: [
      "1570129477492-45c003edd2be",
      "1493809842364-78817add7ffb",
      "1502672260266-1c1ef2d93688",
      "1596394516093-501ba68a0ba6",
      "1542314831-068cd1dbfeeb",
    ],
    rooms: [
      {
        name: "Square view",
        description: "Overlooks the square.",
        capacity: 2,
        beds: 1,
        rate: 8_500,
        amenities: ["wifi", "breakfast", "view"],
      },
      {
        name: "Garden twin",
        description: "Two single beds, on the garden side.",
        capacity: 2,
        beds: 2,
        rate: 8_000,
        amenities: ["wifi", "breakfast", "garden"],
      },
    ],
  },
  {
    name: "Kroum Cabin (demo)",
    area: "Tannourine",
    pin: { latitude: 34.208, longitude: 35.93 },
    description:
      "A timber cabin at the edge of the cedar forest, with a wood stove and trails from the door. Booked as a whole.\n\nDemo listing.",
    categories: ["cabin", "mountain"],
    bookingMode: "OFFLINE",
    wholePlace: true,
    photos: [
      "1449844908441-8829872d2607",
      "1510798831971-661eb04b3739",
      "1518780664697-55e3ad937233",
      "1587061949409-02df41d5e562",
      "1595521624992-48a59aef95e3",
    ],
    rooms: [
      {
        name: "Forest bedroom",
        description: "A double bed under the eaves.",
        capacity: 2,
        beds: 1,
        rate: 6_000,
        amenities: ["fireplace", "heating", "pets"],
      },
      {
        name: "Bunk room",
        description: "Two bunk beds for the children.",
        capacity: 2,
        beds: 2,
        rate: 5_000,
        amenities: ["heating", "pets"],
      },
    ],
  },
  {
    name: "Karm Sunset (demo)",
    area: "West Bekaa",
    pin: { latitude: 33.55, longitude: 35.742 },
    description:
      "Rooms between the vines, wine tastings in the cellar and long tables at harvest.\n\nDemo listing.",
    categories: ["vineyard", "countryside"],
    bookingMode: "OFFLINE",
    photos: [
      "1512917774080-9991f1c4c750",
      "1566073771259-6a8506099945",
      "1600585154340-be6161a56a0c",
      "1551882547-ff40c63fe5fa",
      "1613490493576-7fde63acd811",
    ],
    rooms: [
      {
        name: "Vine room",
        description: "A terrace on the vines.",
        capacity: 2,
        beds: 1,
        rate: 13_000,
        amenities: ["wifi", "ac", "breakfast", "pool"],
      },
    ],
  },
];

/** The demo photos are stock pictures in the same order for every place: outside, a bedroom, a view, a living room, a terrace. */
const PHOTO_AREAS = ["EXTERIOR", "BEDROOM", "VIEW", "LIVING_ROOM", "TERRACE"] as const;

const stockPhotoUrl = (id: string) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1600&q=75`;

interface DemoPartner {
  name: string;
  kind: "RESTAURANT" | "CAFE" | "SUPERMARKET" | "PARK" | "MUSEUM" | "BEACH" | "WINERY" | "OTHER";
  region: "north" | "mount-lebanon" | "bekaa";
  area: string;
  latitude: number;
  longitude: number;
  /** An Unsplash photo id: a stock picture, not the real place. */
  photo: string;
  /** Sponsored for the next 60 days, to show the "Sponsored" mark. */
  sponsored?: boolean;
}

/** Fictional partner places near the demo places (F23), in the same regions, so "Things to do near your stay" has something to show. */
const PARTNERS: DemoPartner[] = [
  {
    name: "Old Souk Café (demo)",
    kind: "CAFE",
    region: "north",
    area: "Batroun",
    latitude: 34.2553,
    longitude: 35.6581,
    photo: "1495474472287-4d71bcdd2085",
    sponsored: true,
  },
  {
    name: "Harbour Fish Grill (demo)",
    kind: "RESTAURANT",
    region: "north",
    area: "Batroun",
    latitude: 34.2571,
    longitude: 35.6565,
    photo: "1517248135467-4c7edcad34c4",
  },
  {
    name: "Sandy Cove Beach (demo)",
    kind: "BEACH",
    region: "north",
    area: "Batroun",
    latitude: 34.2489,
    longitude: 35.6512,
    photo: "1507525428034-b723cf961d3e",
  },
  {
    name: "Cedar Forest Trail (demo)",
    kind: "PARK",
    region: "mount-lebanon",
    area: "Chouf",
    latitude: 33.6875,
    longitude: 35.7089,
    photo: "1441974231531-c6227db76b6e",
    sponsored: true,
  },
  {
    name: "Stone Bakery (demo)",
    kind: "OTHER",
    region: "mount-lebanon",
    area: "Chouf",
    latitude: 33.6971,
    longitude: 35.5626,
    photo: "1509440159596-0249088772ff",
  },
  {
    name: "Village Grocer (demo)",
    kind: "SUPERMARKET",
    region: "mount-lebanon",
    area: "Chouf",
    latitude: 33.6993,
    longitude: 35.5649,
    photo: "1542838132-92c53300491e",
  },
  {
    name: "Mountain Heritage Museum (demo)",
    kind: "MUSEUM",
    region: "mount-lebanon",
    area: "Chouf",
    latitude: 33.6942,
    longitude: 35.5603,
    photo: "1566127444979-b3d2b654e3d7",
  },
  {
    name: "Valley Winery (demo)",
    kind: "WINERY",
    region: "bekaa",
    area: "West Bekaa",
    latitude: 33.5521,
    longitude: 35.7465,
    photo: "1510812431401-41d2bd2722f3",
    sponsored: true,
  },
  {
    name: "Lakeside Kitchen (demo)",
    kind: "RESTAURANT",
    region: "bekaa",
    area: "West Bekaa",
    latitude: 33.5488,
    longitude: 35.7392,
    photo: "1517248135467-4c7edcad34c4",
  },
];

async function main() {
  config({ quiet: true });
  // Loaded after .env, because the server's settings are checked as soon as it is imported.
  const { prisma } = await import("@/server/db/client");
  const { env } = await import("@/server/env");
  const { createVerifiedAccount, ensurePlatformAdmin, findAccountByEmail } =
    await import("@/modules/accounts/server");
  const { createWorkspace } = await import("@/modules/workspaces/server");
  const { confirmBooking, requestBooking } = await import("@/modules/bookings/server");
  const { resolveContext } = await import("@/server/auth/resolve-context");
  const { bookingReference, secureToken } = await import("@/utils/tokens");
  const { addDays, todayUtc } = await import("@/utils/dates");

  const password = env.SEED_PASSWORD ?? "demo-password-123";

  async function demoAccount(email: string, name: string) {
    return (
      (await findAccountByEmail(email)) ?? createVerifiedAccount({ email, name, password, locale: "en" })
    );
  }

  async function seedPlace(place: DemoPlace, ownerId: string) {
    if (await prisma.business.findFirst({ where: { name: place.name } })) return null;
    const business = await createWorkspace(ownerId, { name: place.name, area: place.area });
    const rooms = place.rooms.map((room) => ({
      name: room.name,
      description: room.description,
      capacity: room.capacity,
      beds: room.beds,
      bedrooms: room.bedrooms ?? 1,
      bathrooms: room.bathrooms ?? 1,
      baseRateCents: room.rate,
      amenities: room.amenities,
      exportToken: secureToken(),
    }));
    const sum = (pick: (room: (typeof rooms)[number]) => number) =>
      rooms.reduce((total, room) => total + pick(room), 0);
    await prisma.business.update({
      where: { id: business.id },
      data: {
        description: place.description,
        ...place.pin,
        listedPublicly: true,
        bookingMode: place.bookingMode,
        // The online modes need the owner to have accepted full refunds.
        onlineTermsAcceptedAt: place.bookingMode === "OFFLINE" ? null : new Date(),
        bookingUnit: place.wholePlace ? "WHOLE_PLACE" : "ROOMS",
        whatsapp: "+96170000000",
        paymentInstructions:
          place.bookingMode === "OFFLINE"
            ? "Pay by Whish to 70 000 000 (demo), with your booking reference."
            : null,
        houseRules: "No parties. Quiet after 11 pm.",
        categories: { create: place.categories.map((categorySlug) => ({ categorySlug })) },
        rooms: {
          create: [
            ...rooms,
            // A place booked as a whole gets its one unit, its rooms added up.
            ...(place.wholePlace
              ? [
                  {
                    kind: "WHOLE_PLACE" as const,
                    name: place.name,
                    capacity: sum((room) => room.capacity),
                    beds: sum((room) => room.beds),
                    bedrooms: sum((room) => room.bedrooms),
                    bathrooms: sum((room) => room.bathrooms),
                    baseRateCents: sum((room) => room.baseRateCents),
                    exportToken: secureToken(),
                  },
                ]
              : []),
          ],
        },
        photos: {
          create: place.photos.map((id, position) => ({
            url: stockPhotoUrl(id),
            alt: `${place.name}, stock photo`,
            area: PHOTO_AREAS[position] ?? null,
            position,
          })),
        },
      },
    });
    return business;
  }

  await prisma.$transaction(
    CATEGORIES.map((category, position) =>
      prisma.category.upsert({
        where: { slug: category.slug },
        create: { ...category, kind: "HOME", position },
        update: { ...category, kind: "HOME", position, isDeleted: false },
      }),
    ),
  );

  const admin = await ensurePlatformAdmin({ name: "Demo Admin", email: "admin@mabeet.test", password });
  const host = await demoAccount("host@mabeet.test", "Demo Host");
  const staff = await demoAccount("staff@mabeet.test", "Demo Front Desk");
  const guest = await demoAccount("guest@mabeet.test", "Demo Guest");

  const created = [];
  for (const place of PLACES) {
    const business = await seedPlace(place, host.id);
    if (business) created.push({ place, business });
  }

  // Places made before they had a map pin get theirs; a pin the host set is left as it is.
  for (const place of PLACES) {
    await prisma.business.updateMany({ where: { name: place.name, latitude: null }, data: place.pin });
  }

  // The front desk of the stage place, so roles can be tried without setting anything up.
  const stage = await prisma.business.findFirstOrThrow({ where: { name: PLACES[0]?.name } });
  const frontDesk = await prisma.role.findFirstOrThrow({
    where: { businessId: stage.id, name: "Front desk" },
  });
  await prisma.membership.upsert({
    where: { userId_businessId: { userId: staff.id, businessId: stage.id } },
    create: { userId: staff.id, businessId: stage.id, roleId: frontDesk.id },
    update: { roleId: frontDesk.id, status: "ACTIVE" },
  });

  // A request waiting for the host and a confirmed stay at the offline place, made through the booking engine.
  const offline = created.find(({ place }) => place.name === "Beit Ghazir (demo)");
  if (offline) {
    const [first, second] = await prisma.room.findMany({
      where: { businessId: offline.business.id, kind: "ROOM" },
      orderBy: { createdAt: "asc" },
    });
    const today = todayUtc();
    const stay = (roomId: string, fromToday: number, nights: number) => ({
      businessSlug: offline.business.slug,
      roomId,
      range: { checkIn: addDays(today, fromToday), checkOut: addDays(today, fromToday + nights) },
      guestCount: 2,
      guestName: "Demo Guest",
      guestPhone: "+96170000001",
      guestEmail: guest.email,
      guestNote: null,
      guestUserId: guest.id,
      locale: "en",
    });
    if (first && second) {
      await requestBooking(stay(first.id, 7, 2));
      const confirmed = await requestBooking(stay(second.id, 12, 3));
      const ctx = await resolveContext(host.id, offline.business.id);
      if (ctx) await confirmBooking(ctx, { bookingId: confirmed.id });
    }
  }

  // A stay the demo guest made three weeks ago at the offline place, and their review of it. Written straight to the
  // database, because the booking engine takes no stay in the past; only once, whenever the place has no review yet.
  const reviewed = await prisma.business.findFirst({
    where: { name: "Beit Ghazir (demo)", isDeleted: false },
  });
  const reviewedRoom =
    reviewed &&
    (await prisma.room.findFirst({
      where: { businessId: reviewed.id, kind: "ROOM", isDeleted: false },
      orderBy: { createdAt: "asc" },
    }));
  if (reviewed && reviewedRoom && !(await prisma.review.findFirst({ where: { businessId: reviewed.id } }))) {
    const checkIn = addDays(todayUtc(), -21);
    const checkOut = addDays(checkIn, 2);
    const past = await prisma.booking.create({
      data: {
        businessId: reviewed.id,
        roomId: reviewedRoom.id,
        guestUserId: guest.id,
        guestName: "Demo Guest",
        guestPhone: "+96170000001",
        guestEmail: guest.email,
        guestCount: 2,
        checkIn,
        checkOut,
        totalCents: reviewedRoom.baseRateCents * 2,
        currency: reviewed.currency,
        reference: bookingReference(),
        publicToken: secureToken(),
        bookingMode: reviewed.bookingMode,
        status: "CONFIRMED",
        occupancy: {
          create: { businessId: reviewed.id, roomId: reviewedRoom.id, checkIn, checkOut, kind: "DIRECT" },
        },
      },
    });
    await prisma.review.create({
      data: {
        businessId: reviewed.id,
        roomId: reviewedRoom.id,
        bookingId: past.id,
        authorId: guest.id,
        rating: 5,
        comment: "A quiet stone house by the sea, and breakfast on the terrace every morning. We'll be back.",
      },
    });
  }

  // The demo partners, each made once. A sponsored one is sponsored from the day it is made, for 60 days, by the
  // demo admin.
  let partnersMade = 0;
  for (const partner of PARTNERS) {
    if (await prisma.partnerPlace.findFirst({ where: { name: partner.name } })) continue;
    const { photo, sponsored, ...fields } = partner;
    const today = todayUtc();
    await prisma.partnerPlace.create({
      data: {
        ...fields,
        photoUrl: stockPhotoUrl(photo),
        phone: "+96170000000",
        sponsorships: sponsored
          ? { create: { startsOn: today, endsOn: addDays(today, 60), createdById: admin.userId } }
          : undefined,
      },
    });
    partnersMade++;
  }

  console.log(
    `Seeded ${CATEGORIES.length} categories and ${created.length} new demo places (${PLACES.length - created.length} were already there), and ${partnersMade} new demo partners.`,
  );
  console.log(
    "Sign in as host@, staff@, guest@ or admin@mabeet.test with the SEED_PASSWORD (demo-password-123 if empty).",
  );
}

// The demo bookings send their notification jobs, which opens the job queue's own connection; the seed is done once
// its rows are written, so it ends here rather than waiting on that connection.
main().then(
  () => process.exit(0),
  (error: unknown) => {
    console.error(error);
    process.exit(1);
  },
);
