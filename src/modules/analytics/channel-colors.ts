// Each booking channel's colour, the same on every chart; the platforms wear their own brand colour.

const CHANNEL_COLOR: Record<string, string> = {
  DIRECT: "bg-accent",
  AIRBNB: "bg-brand-airbnb",
  BOOKING: "bg-brand-booking",
  OTHER: "bg-faint",
  MANUAL: "bg-line-strong",
};

export const channelColor = (channel: string): string => CHANNEL_COLOR[channel] ?? "bg-faint";
