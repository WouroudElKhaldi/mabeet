import { z } from "zod";
import { ALL_PERMISSIONS, type Permission } from "@/config/permissions";
import { id, phone, workspaceParams } from "@/lib/schemas";

export const roleParams = workspaceParams.extend({ roleId: id });

export const invitationParams = workspaceParams.extend({ invitationId: id });

export const memberParams = workspaceParams.extend({ membershipId: id });

export const roleInput = z.object({
  name: z.string().trim().min(2).max(40),
  description: z.string().trim().max(200).nullish(),
  permissions: z.array(z.enum(ALL_PERMISSIONS as [Permission, ...Permission[]])).max(ALL_PERMISSIONS.length),
});

export const memberUpdate = z.object({ roleId: id });

/** A host invites someone to the team, with the role they will have. */
export const invitationInput = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.email().max(254),
  phone,
  roleId: id,
});

/** The secret in an invitation link. */
export const invitationToken = z.object({ token: z.string().min(20).max(64) });

/** Registering from an invitation: the email is the invited one, so it is not asked again. */
export const invitationRegister = z.object({
  name: z.string().trim().min(2).max(80),
  phone,
  password: z.string().min(10).max(128),
});
