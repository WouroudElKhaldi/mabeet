import type { PartnerKind } from "@prisma/client";

/** A partner place as guests see it near their stay. `sponsored` ones are always shown with the "Sponsored" mark. */
export interface NearbyPartner {
  id: string;
  name: string;
  kind: PartnerKind;
  region: string;
  area: string | null;
  photoUrl: string | null;
  websiteUrl: string | null;
  phone: string | null;
  sponsored: boolean;
  /** How far it is from the place, in kilometres, or null when either has no map pin. */
  distanceKm: number | null;
}
