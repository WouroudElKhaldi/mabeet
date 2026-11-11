import { z } from "zod";
import { partnerInput } from "@/modules/partners";
import { createPartner, listPartnersForAdmin } from "@/modules/partners/server";
import { adminRoute, json, parseBody } from "@/server/http/route";

/** Every partner place, removed ones last, with their sponsorships not over yet. Platform admins only. */
export const GET = adminRoute(z.object({}), async ({ actor }) => json(await listPartnersForAdmin(actor)));

/** Adds a partner place near guesthouses. */
export const POST = adminRoute(z.object({}), async ({ request, actor }) =>
  json(await createPartner(actor, await parseBody(request, partnerInput)), 201),
);
