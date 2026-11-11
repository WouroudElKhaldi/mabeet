import type { PartnerKind } from "@prisma/client";

// What a partner place is (featured partners, F23): the admin picks one, and guests see its label. The labels live
// in messages/*.json (partners.kinds). `satisfies` checks the list against the database enum.

export const PARTNER_KINDS = [
  "RESTAURANT",
  "CAFE",
  "SUPERMARKET",
  "PARK",
  "MUSEUM",
  "BEACH",
  "WINERY",
  "OTHER",
] as const satisfies readonly PartnerKind[];

/** The partners shown in the admin's table: the live ones, or the removed ones to bring back. */
export const PARTNER_LIST_STATES = ["live", "removed"] as const;
