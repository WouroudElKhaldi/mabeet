import { notFound } from "next/navigation";
import { AppError } from "@/server/errors";

/** Server pages: a domain NOT_FOUND becomes the 404 page; anything else propagates. */
export async function findPageOr404<T>(lookup: Promise<T>): Promise<T> {
  try {
    return await lookup;
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") notFound();
    throw error;
  }
}
