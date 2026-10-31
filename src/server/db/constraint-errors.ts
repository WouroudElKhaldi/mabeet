import { isOverlapError, isUniqueViolation } from "@/server/db/client";
import { conflict } from "@/server/errors";

// The database enforces the rules that must hold under concurrency (no double bookings, one review per stay).
// These wrappers turn its refusal into a 409 with a message people can act on; any other error passes through.

async function rethrowAsConflict<T>(
  violated: (error: unknown) => boolean,
  message: string,
  write: () => Promise<T>,
): Promise<T> {
  try {
    return await write();
  } catch (error) {
    if (violated(error)) throw conflict(message);
    throw error;
  }
}

/** An EXCLUDE constraint refused overlapping nights or seats. */
export const overlapAsConflict = <T>(message: string, write: () => Promise<T>) =>
  rethrowAsConflict(isOverlapError, message, write);

/** A unique constraint refused a second copy of something. */
export const duplicateAsConflict = <T>(message: string, write: () => Promise<T>) =>
  rethrowAsConflict(isUniqueViolation, message, write);
