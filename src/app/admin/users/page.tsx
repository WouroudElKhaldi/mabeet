import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader, Panel } from "@/components/shell/page-header";
import { Pill } from "@/components/ui/pill";
import { listPlatformPeople } from "@/modules/accounts/server";
import { requirePageAdmin } from "@/server/http/session";
import { toIsoDate } from "@/utils/dates";
import { formatDate } from "@/utils/format";

/** The newest accounts: guests, hosts and their teams, and the platform admins. */
export default async function AdminUsersPage() {
  const actor = await requirePageAdmin();
  const [t, tShell, locale, { people }] = await Promise.all([
    getTranslations("admin"),
    getTranslations("shell"),
    getLocale(),
    listPlatformPeople(actor),
  ]);

  return (
    <>
      <PageHeader title={t("nav.users")} intro={t("usersIntro")} />
      <Panel title={t("recentUsers")}>
        <ul className="divide-y divide-line">
          {people.map((person) => (
            <li key={person.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 font-semibold">
                  <bdi>{person.name}</bdi>
                  {person.platformRole === "SUPER_ADMIN" && <Pill tone="accent">{tShell("admin")}</Pill>}
                </p>
                <p className="truncate text-sm text-muted">
                  <bdi dir="ltr">{person.email}</bdi>
                </p>
              </div>
              <p className="text-sm text-muted">
                {t("userCounts", { places: person.placeCount, trips: person.tripCount })} · {t("since")}{" "}
                {formatDate(toIsoDate(person.createdAt), locale)}
              </p>
            </li>
          ))}
        </ul>
      </Panel>
    </>
  );
}
