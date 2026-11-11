import type { ReviewStatus } from "@prisma/client";

/** A review as a place's page shows it. */
export interface PlaceReview {
  id: string;
  rating: number;
  comment: string;
  /** The guest's name, or null once they have closed their account: the review stays, the name goes. */
  authorName: string | null;
  /** The day it was written, as an ISO date, so the page can say when without a clock of its own. */
  writtenOn: string;
  /** What the host answered, when they did. */
  ownerReply: string | null;
}

/** What a place's reviews add up to, for its title row and its cards. */
export interface PlaceRating {
  /** To one decimal, or null until a guest has rated it. */
  average: number | null;
  count: number;
}

/** A review as the place's team sees it on the dashboard's Reviews page, hidden ones included. */
export interface TeamReview extends PlaceReview {
  status: ReviewStatus;
  /** Why the team hid it, while it is hidden. */
  hiddenReason: string | null;
  /** The room and booking the stay was, so the team knows which guest it was. */
  roomName: string | null;
  bookingReference: string | null;
}
