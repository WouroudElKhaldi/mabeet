import { getTranslations } from "next-intl/server";
import { ButtonLink } from "@/components/ui/button";
import { WhatsAppLink } from "@/components/site/whatsapp-link";
import { isLanguage } from "@/config/listing";
import { acceptsMessages, offersWhatsapp, responseSpeed, yearsHosting } from "../host";
import type { PublicPlace } from "../types";

/**
 * Meet your host: who hosts this place, how long they have hosted and how they answer, then the ways to reach them.
 * The host's own details appear only when they turned their profile on; how to reach them is their setting, so those
 * buttons follow it either way. The WhatsApp number is always the place's own.
 */
export async function MeetHost({
  place,
}: {
  place: Pick<PublicPlace, "slug" | "name" | "whatsapp" | "host">;
}) {
  const t = await getTranslations("meetHost");
  const names = await getTranslations("listing.languages");
  const { profile, response, contactBy } = place.host;
  const years = yearsHosting(profile?.hostingSince ?? null);
  const spokenLanguages = (profile?.languages ?? []).filter(isLanguage);
  const whatsapp = offersWhatsapp(contactBy) ? place.whatsapp : null;
  const takesMessages = acceptsMessages(contactBy, place.whatsapp);

  // The two figures guests weigh a host by. How quickly they answer is a sentence of its own under them: it reads
  // as what it is ("Responds within an hour") and needs no label.
  const facts = [
    years === null || years === 0 ? null : { label: t("years", { count: years }), value: String(years) },
    response === null ? null : { label: t("responseRate"), value: `${Math.round(response.rate * 100)}%` },
  ].filter((fact): fact is { label: string; value: string } => fact !== null);
  const speed =
    response === null || response.medianMinutes === null ? null : responseSpeed(response.medianMinutes);

  return (
    <div className="grid gap-6 rounded-2xl bg-surface-2 p-5 sm:p-6">
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
        {profile ? (
          <p
            aria-hidden
            className="arch grid size-18 shrink-0 place-items-center bg-accent text-2xl font-semibold text-accent-ink"
          >
            {[...profile.name][0] ?? ""}
          </p>
        ) : null}
        <div className="min-w-0">
          <p className="text-xl font-semibold">{profile?.name ?? place.name}</p>
          {years === 0 ? <p className="mt-1 text-sm text-muted">{t("new")}</p> : null}
          {spokenLanguages.length > 0 ? (
            <p className="mt-1 text-sm text-muted">
              {t("speaks", { languages: spokenLanguages.map((code) => names(code)).join(", ") })}
            </p>
          ) : null}
        </div>
      </div>

      {facts.length > 0 || speed ? (
        <div className="grid gap-3 border-t border-line pt-5">
          {facts.length > 0 ? (
            <dl className="flex flex-wrap gap-x-10 gap-y-4">
              {facts.map((fact) => (
                <div key={fact.label}>
                  <dt className="text-sm text-muted">{fact.label}</dt>
                  <dd className="text-lg font-semibold">{fact.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {speed ? <p className="font-semibold">{t(speed)}</p> : null}
        </div>
      ) : null}

      {profile?.bio ? <p className="leading-relaxed whitespace-pre-line">{profile.bio}</p> : null}

      {/* acceptsMessages keeps Contact host whenever there is no WhatsApp number, so one of them always shows. */}
      <div className="grid gap-3 sm:flex sm:flex-wrap">
        {takesMessages ? (
          <ButtonLink href={`/p/${place.slug}/contact`} variant="secondary" size="lg">
            {t("contact")}
          </ButtonLink>
        ) : null}
        {whatsapp ? (
          <span className="sm:w-auto">
            <WhatsAppLink phone={whatsapp} label={t("whatsapp")} />
          </span>
        ) : null}
      </div>

      <p className="text-sm text-muted">{t("protect")}</p>
    </div>
  );
}
