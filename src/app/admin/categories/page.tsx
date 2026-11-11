import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/shell/page-header";
import { DataCell, DataRow, DataTable } from "@/components/ui/data-table";
import { ListFilters } from "@/components/ui/list-filters";
import { Pagination } from "@/components/ui/pagination";
import { categoryIcon } from "@/config/category-icons";
import { LISTING_KINDS } from "@/config/enums";
import { CategoryActions, categoriesQuery, NewCategoryButton } from "@/modules/admin";
import { listCategoryPage } from "@/modules/admin/server";
import { requirePageAdmin } from "@/server/http/session";
import { listHref } from "@/utils/paging";

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const PATH = "/admin/categories";

/** The categories guests browse by, for places, experiences and services, as a table; adding and editing pop up. */
export default async function AdminCategoriesPage({ searchParams }: PageProps) {
  const actor = await requirePageAdmin();
  const { page, q, kind } = categoriesQuery.parse(await searchParams);
  const [t, list] = await Promise.all([
    getTranslations("admin.categories"),
    listCategoryPage(actor, { q, kind }, page),
  ]);

  return (
    <>
      <PageHeader title={t("title")} intro={t("hint")} actions={<NewCategoryButton />} />
      <ListFilters
        label={t("filters")}
        path={PATH}
        search={q}
        searchPlaceholder={t("searchPlaceholder")}
        total={list.total}
        choices={[
          {
            name: "kind",
            label: t("kind"),
            value: kind,
            options: LISTING_KINDS.map((value) => ({ value, label: t(`kinds.${value}`) })),
          },
        ]}
      />
      {list.categories.length === 0 ? (
        <p className="rounded-xl bg-surface-2 p-4 text-sm text-muted">{t("empty")}</p>
      ) : (
        <DataTable
          label={t("title")}
          columns={[
            { label: t("name") },
            { label: t("kind"), wide: true },
            { label: t("nameAr"), wide: true },
            { label: t("position"), align: "end", wide: true },
            { label: t("used"), align: "end", wide: true },
            { label: t("actions"), align: "end", hiddenLabel: true },
          ]}
        >
          {list.categories.map((category) => {
            const Icon = categoryIcon(category.icon);
            return (
              <DataRow key={category.slug}>
                <DataCell>
                  <p className="flex items-center gap-2 font-semibold">
                    <Icon className="size-5 shrink-0 text-accent" aria-hidden />
                    <bdi dir="ltr">{category.nameEn}</bdi>
                  </p>
                  <code dir="ltr" className="text-xs text-muted">
                    {category.slug}
                  </code>
                </DataCell>
                <DataCell wide>{t(`kinds.${category.kind}`)}</DataCell>
                <DataCell wide>
                  <bdi dir="rtl">{category.nameAr}</bdi>
                </DataCell>
                <DataCell align="end" wide className="tabular-nums">
                  {category.position}
                </DataCell>
                <DataCell align="end" wide className="tabular-nums">
                  {category.uses}
                </DataCell>
                <DataCell align="end">
                  <CategoryActions category={category} />
                </DataCell>
              </DataRow>
            );
          })}
        </DataTable>
      )}
      <Pagination
        order="list"
        page={list.page}
        pages={list.pages}
        href={(target) => listHref(PATH, { q, kind }, target)}
      />
    </>
  );
}
