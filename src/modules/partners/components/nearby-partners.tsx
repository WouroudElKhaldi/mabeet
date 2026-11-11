import { Globe, Phone } from "lucide-react";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { PlaceArt } from "@/components/brand/place-art";
import { ScrollRail } from "@/components/ui/scroll-rail";
import type { NearbyPartner } from "../types";

const linkClass =
  "inline-flex items-center gap-1.5 rounded-full text-sm font-semibold underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-ink";

/** Social pages are named for what they are, so a guest knows the link opens Instagram rather than a website. */
const SOCIAL_SITES: Record<string, string> = {
  "instagram.com": "Instagram",
  "facebook.com": "Facebook",
  "tiktok.com": "TikTok",
};

function socialSite(link: string): string | undefined {
  const host = new URL(link).hostname.replace(/^(www|m)\./, "");
  return SOCIAL_SITES[host];
}

/**
 * One partner near the stay: its photo with its kind, "Sponsored" when it is, its name, town and distance, and how to
 * reach it. The photo can be on any https site, so it is shown as it is rather than through our image resizer, which
 * only takes our own hosts.
 */
async function PartnerCard({ partner }: { partner: NearbyPartner }) {
  const t = await getTranslations("partners");
  const where = [
    partner.area,
    partner.distanceKm === null ? null : t("nearby.distance", { km: partner.distanceKm }),
  ].filter(Boolean);
  return (
    <article className="w-60 shrink-0">
      <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-surface-2">
        {partner.photoUrl ? (
          <Image
            src={partner.photoUrl}
            alt={partner.name}
            fill
            unoptimized
            loading="lazy"
            className="object-cover"
          />
        ) : (
          <PlaceArt seed={partner.id} className="size-full" />
        )}
        <span className="absolute start-2.5 top-2.5 rounded-full bg-surface/95 px-2.5 py-1 text-xs font-semibold text-ink shadow-soft">
          {t(`kinds.${partner.kind}`)}
        </span>
        {partner.sponsored ? (
          <span className="absolute end-2.5 top-2.5 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-bold text-ink ring-1 ring-accent-line">
            {t("nearby.sponsored")}
          </span>
        ) : null}
      </div>
      <div className="mt-2.5 grid gap-0.5 text-sm leading-snug">
        <h3 className="truncate font-semibold tracking-normal">{partner.name}</h3>
        {where.length > 0 ? <p className="truncate text-muted">{where.join(" · ")}</p> : null}
        {partner.websiteUrl || partner.phone ? (
          <p className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
            {partner.websiteUrl ? (
              <a href={partner.websiteUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>
                <Globe className="size-4 text-accent" aria-hidden />
                {socialSite(partner.websiteUrl) ?? t("nearby.website")}
              </a>
            ) : null}
            {partner.phone ? (
              <a href={`tel:${partner.phone}`} dir="ltr" className={linkClass}>
                <Phone className="size-4 text-accent" aria-hidden />
                {partner.phone}
              </a>
            ) : null}
          </p>
        ) : null}
      </div>
    </article>
  );
}

/**
 * Things to do near the stay: the partner places of the place's region, sponsored ones first, in a row that scrolls
 * sideways inside itself on a phone. The page leaves the section out when there are none.
 */
export async function NearbyPartners({ partners }: { partners: NearbyPartner[] }) {
  const t = await getTranslations("partners.nearby");
  return (
    <ScrollRail label={t("title")} labels={{ previous: t("previous"), next: t("next") }}>
      {partners.map((partner) => (
        <PartnerCard key={partner.id} partner={partner} />
      ))}
    </ScrollRail>
  );
}
