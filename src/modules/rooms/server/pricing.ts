import { type DateRange, eachNight, toIsoDate } from "@/utils/dates";

// The price of a stay. Pure, so every price a guest sees (the place page, the booking, the AI) is worked out the
// same way.

interface NightlyRate {
  date: string;
  rateCents: number;
}

export interface StayQuote {
  nights: NightlyRate[];
  totalCents: number;
}

interface PricingInput {
  range: DateRange;
  baseRateCents: number;
  /** Special prices keyed by ISO date. */
  overrides: ReadonlyMap<string, number>;
}

/** The price of each night and the total, which is what the guest pays: there are no deposits. */
export function quoteStay({ range, baseRateCents, overrides }: PricingInput): StayQuote {
  const nights = eachNight(range).map((night) => {
    const date = toIsoDate(night);
    return { date, rateCents: overrides.get(date) ?? baseRateCents };
  });
  return { nights, totalCents: nights.reduce((sum, night) => sum + night.rateCents, 0) };
}
