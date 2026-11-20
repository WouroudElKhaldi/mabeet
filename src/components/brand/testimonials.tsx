import { House, Mountain, Quote, Trees } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { ScrollRail } from "@/components/ui/scroll-rail";

// What the first owners wrote to us, one message per card, and nobody's name. The words are in the message files,
// so every language reads them in its own words.

// Each owner: who wrote, its picture, and the messages they sent, in order.
const OWNERS = [
  { owner: "guesthouse", icon: House, messages: ["guesthouse.m1", "guesthouse.m2", "guesthouse.m3"] },
  {
    owner: "chalet",
    icon: Mountain,
    messages: ["chalet.m1", "chalet.m2", "chalet.m3", "chalet.m4", "chalet.m5"],
  },
  { owner: "home", icon: Trees, messages: ["home.m1", "home.m2"] },
] as const;

// The cards take turns between owners, so the row never shows one owner's messages back to back.
const CARDS = Array.from({ length: Math.max(...OWNERS.map((entry) => entry.messages.length)) }).flatMap(
  (_, index) =>
    OWNERS.flatMap(({ owner, icon, messages }) => {
      const message = messages[index];
      return message ? [{ owner, icon, message }] : [];
    }),
);

/** Owners' messages as a row of cards that slides sideways: each message alone, with who wrote it. */
export async function Testimonials() {
  const t = await getTranslations("home.testimonials");

  return (
    <section className="mx-auto mt-24 max-w-360 px-4 sm:px-6 lg:px-10">
      <h2 className="font-poster text-[clamp(1.75rem,3vw,2.5rem)]">{t("title")}</h2>
      <p className="mt-3 max-w-lg leading-relaxed text-muted">{t("subtitle")}</p>

      <div className="mt-8 flex">
        <ScrollRail label={t("title")} labels={{ previous: t("previous"), next: t("next") }}>
          {CARDS.map(({ owner, icon: Icon, message }) => (
            <article
              key={message}
              className="flex w-[min(82vw,22rem)] shrink-0 flex-col rounded-2xl bg-surface p-5 ring-1 ring-line ring-inset"
            >
              <Quote className="size-6 text-accent rtl:-scale-x-100" aria-hidden />
              <p className="mt-3 flex-1 text-[1.0625rem] leading-relaxed">{t(message)}</p>
              <footer className="mt-5 flex items-center gap-3 border-t border-line pt-4">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
                  <Icon className="size-4.5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{t(`owners.${owner}`)}</p>
                  <p className="text-xs text-muted">{t("toMabeet")}</p>
                </div>
              </footer>
            </article>
          ))}
        </ScrollRail>
      </div>
    </section>
  );
}
