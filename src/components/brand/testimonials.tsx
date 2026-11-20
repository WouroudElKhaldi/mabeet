import { CheckCheck, House, Mountain, Trees } from "lucide-react";
import { getTranslations } from "next-intl/server";

// What the first owners wrote to us, each as the chat it came in: the owner's messages one after another, in full,
// and nobody's name. The words are in the message files, so every language reads them in its own words.

// Each chat: who wrote, its picture, when the last message arrived (as the chat showed it), and its messages in order.
const CHATS = [
  {
    owner: "guesthouse",
    icon: House,
    time: "12:45",
    messages: ["guesthouse.m1", "guesthouse.m2", "guesthouse.m3"],
  },
  {
    owner: "chalet",
    icon: Mountain,
    time: "13:19",
    messages: ["chalet.m1", "chalet.m2", "chalet.m3", "chalet.m4", "chalet.m5"],
  },
  { owner: "home", icon: Trees, time: "14:08", messages: ["home.m1", "home.m2", "home.m3"] },
] as const;

/** Owners' messages as chat threads: a header with who wrote, then their bubbles, the last one with its time. */
export async function Testimonials() {
  const t = await getTranslations("home.testimonials");

  return (
    <section className="mx-auto mt-24 max-w-360 px-4 sm:px-6 lg:px-10">
      <h2 className="font-poster text-[clamp(1.75rem,3vw,2.5rem)]">{t("title")}</h2>
      <p className="mt-3 max-w-lg leading-relaxed text-muted">{t("subtitle")}</p>

      <div className="mt-8 grid items-start gap-5 lg:grid-cols-3">
        {CHATS.map(({ owner, icon: Icon, time, messages }) => (
          <article key={owner} className="overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
            <header className="flex items-center gap-3 border-b border-line px-4 py-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
                <Icon className="size-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <h3 className="truncate font-semibold">{t(`owners.${owner}`)}</h3>
                <p className="text-xs text-muted">{t("toMabeet")}</p>
              </div>
            </header>

            <ol className="flex flex-col gap-1.5 bg-surface-2 px-3 py-4 sm:px-4">
              {messages.map((message, index) => {
                const last = index === messages.length - 1;
                return (
                  <li key={message} className="flex">
                    <p
                      className={`max-w-[92%] rounded-2xl bg-surface px-3.5 py-2 text-[0.9375rem] leading-relaxed shadow-sm ring-1 ring-line ${
                        index === 0 ? "rounded-ss-sm" : ""
                      }`}
                    >
                      {t(message)}
                      {last && (
                        <span className="ms-2 inline-flex translate-y-0.5 items-center gap-1 text-[0.6875rem] text-muted">
                          <span dir="ltr">{time}</span>
                          <CheckCheck className="size-3.5 text-accent" aria-hidden />
                        </span>
                      )}
                    </p>
                  </li>
                );
              })}
            </ol>
          </article>
        ))}
      </div>
    </section>
  );
}
