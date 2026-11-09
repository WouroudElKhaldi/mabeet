import type { HostContact } from "@prisma/client";
import type { z } from "zod";
import { recordAction } from "@/modules/audit/server";
import { requireBusinessOwner, type TenantContext } from "@/server/auth/tenant-context";
import { prisma } from "@/server/db/client";
import type { hostProfileInput } from "../schemas";
import { findOwnHostProfile, findPlaceHost, saveHostProfile } from "./host-repository";

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

const OWNERS_ONLY = "Only an owner has a host profile";

/** The owner's own host profile, to edit; null before the first save. Owners only: staff and visiting admins are not the host. */
export async function getMyHostProfile(ctx: TenantContext) {
  requireBusinessOwner(ctx, OWNERS_ONLY);
  return findOwnHostProfile(prisma, ctx.userId);
}

/**
 * Saves the owner's host profile. It is the person's, shared by every place they own, so it is saved on them, not on
 * this place; the log line goes to the place they saved it from.
 */
export async function saveMyHostProfile(ctx: TenantContext, input: z.infer<typeof hostProfileInput>) {
  requireBusinessOwner(ctx, OWNERS_ONLY);
  const profile = await saveHostProfile(prisma, ctx.userId, {
    ...input,
    hostingSince: input.hostingSince ?? null,
  });
  await recordAction(ctx, "host_profile.updated", "host_profile", ctx.userId);
  return profile;
}
