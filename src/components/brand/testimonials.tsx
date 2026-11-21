import { clsx } from "clsx";
import { House, Mountain, Quote, Trees } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Reveal } from "@/components/ui/reveal";
import { ScrollRail } from "@/components/ui/scroll-rail";
import { stagger } from "@/utils/motion";
import { Postmark } from "./postmark";

// What the first owners wrote to us, one message per card, signed with their place. Only the messages that stand out
// are kept. The words are in the message files, so every language reads them in its own words.

// Each owner: their place, its picture, and the messages we show, in the order they were sent.
const OWNERS = [
  { owner: "guesthouse", icon: House, messages: ["guesthouse.m1", "guesthouse.m2"] },
  { owner: "chalet", icon: Mountain, messages: ["chalet.m1", "chalet.m2"] },
  { owner: "home", icon: Trees, messages: ["home.m1"] },
] as const;

// The cards take turns between owners, so the row never shows one owner's messages back to back.
const CARDS = Array.from({ length: Math.max(...OWNERS.map((entry) => entry.messages.length)) }).flatMap(
  (_, index) =>
    OWNERS.flatMap(({ owner, icon, messages }) => {
      const message = messages[index];
      return message ? [{ owner, icon, message }] : [];
    }),
);

/**
 * Owners' messages as postcards to Mabeet, in a row that slides sideways: each message alone, stamped, signed with
 * the place that wrote it. The cards lean a little each way, like the receipts above them, and rise in as the row comes into
 * view.
 */
export async function Testimonials() {
  const t = await getTranslations("home.testimonials");

  return (
    <section className="mx-auto mt-24 max-w-360 overflow-x-clip px-4 sm:px-6 lg:px-10">
      <div className="flex items-end justify-between gap-6">
        <div>
          <h2 className="font-poster text-[clamp(1.75rem,3vw,2.5rem)]">{t("title")}</h2>
          <p className="mt-3 max-w-lg leading-relaxed text-muted">{t("subtitle")}</p>
        </div>
        <Postmark className="hidden size-24 shrink-0 -rotate-12 opacity-80 sm:block" spin />
      </div>

      <Reveal className="mt-6 flex">
        <ScrollRail label={t("title")} labels={{ previous: t("previous"), next: t("next") }}>
          {CARDS.map(({ owner, icon: Icon, message }, index) => (
            <div
              key={message}
              className="reveal-item flex w-[min(80vw,21rem)] shrink-0 px-1 pt-5 pb-8"
              style={stagger(Math.min(index, 4))}
            >
              <article
                className={clsx(
                  "relative flex w-full flex-col rounded-2xl bg-surface px-6 pt-6 pb-5 ring-1 ring-line ring-inset",
                  "drop-shadow-[0_18px_28px_rgb(0_0_0/0.12)] transition-transform duration-300 hover:rotate-0",
                  index % 2 ? "rotate-1" : "-rotate-1",
                )}
              >
                <span className="grid size-11 place-items-center rounded-full bg-accent text-accent-ink">
                  <Quote className="size-5 fill-current rtl:-scale-x-100" aria-hidden />
                </span>
                <p className="mt-5 flex-1 text-[1.0625rem] leading-relaxed font-medium">{t(message)}</p>
                <div className="my-5 border-t border-dashed border-line-strong" />
                <footer className="flex items-center gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
                    <Icon className="size-4.5" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{t(`places.${owner}`)}</p>
                    <p className="text-[0.6875rem] font-bold tracking-[0.18em] text-muted uppercase rtl:tracking-normal">
                      {t(`owners.${owner}`)}
                    </p>
                  </div>
                </footer>
              </article>
            </div>
          ))}
        </ScrollRail>
      </Reveal>
    </section>
  );
}
