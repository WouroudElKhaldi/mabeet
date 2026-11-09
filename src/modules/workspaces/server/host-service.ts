import type { HostContact } from "@prisma/client";
import { prisma } from "@/server/db/client";
import { findPlaceHost } from "./host-repository";

// The host as guests see them. The profile is private until the host turns it on; how guests may reach them is a
// setting, not a personal detail, so it always applies.

/** A place's host on its public pages. */
export interface HostSection {
  /** How guests may reach the host: WhatsApp, the Contact host page, or both. */
  contactBy: HostContact;
  /** The host's own details, only when they chose to show them on their listings. */
  profile: {
    name: string;
    bio: string | null;
    city: string | null;
    /** Language codes, as the host picked them. */
    languages: string[];
    /** The year they started hosting. */
    hostingSince: number | null;
  } | null;
}

/** The schema's own default: a host who never filled in a profile can be reached both ways. */
const DEFAULT_CONTACT: HostContact = "BOTH";

/**
 * The host section of a place's page and its Contact host page. A plain read of public facts: the personal details
 * appear only when the host turned their profile on, and a host with no profile (or a deleted one) is reached both
 * ways, the default.
 */
export async function getHostSection(businessId: string): Promise<HostSection> {
  const host = await findPlaceHost(prisma, businessId);
  const profile = host?.user.hostProfile;
  if (!host || !profile || profile.isDeleted) return { contactBy: DEFAULT_CONTACT, profile: null };
  return {
    contactBy: profile.contactBy,
    profile: profile.showOnListings
      ? {
          name: profile.displayName?.trim() || host.user.name,
          bio: profile.bio,
          city: profile.city,
          languages: profile.languages,
          hostingSince: profile.hostingSince,
        }
      : null,
  };
}
