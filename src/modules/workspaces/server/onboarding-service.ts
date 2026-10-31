import type { z } from "zod";
import { DEFAULT_ROLE_TEMPLATES } from "@/config/permissions";
import { prisma, runInTransaction } from "@/server/db/client";
import { duplicateAsConflict } from "@/server/db/constraint-errors";
import { uniqueSlug } from "@/utils/slug";
import type { workspaceInput } from "../schemas";
import { createBusinessWithOwner, slugExists } from "./business-repository";

/**
 * Creates a business with an owner role, starter roles the owner can edit, and the creator as owner, all in one
 * transaction: if any of them fails, none of them is saved. Two places named alike at the same moment can pick the
 * same link; the database keeps it unique, and the second is asked to try again (it then gets its own link).
 */
export async function createWorkspace(ownerUserId: string, input: z.infer<typeof workspaceInput>) {
  const slug = await uniqueSlug(input.name, "place", (candidate) => slugExists(prisma, candidate));
  return duplicateAsConflict("A place with this name was created at the same moment. Please try again.", () =>
    runInTransaction((tx) =>
      createBusinessWithOwner(tx, {
        business: { ...input, slug },
        ownerUserId,
        starterRoles: DEFAULT_ROLE_TEMPLATES,
      }),
    ),
  );
}
