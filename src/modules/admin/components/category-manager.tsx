"use client";

import type { ListingKind } from "@prisma/client";
import { Pencil, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { inputClass, LabeledControl } from "@/components/ui/field";
import { FormDialog, useCloseDialog } from "@/components/ui/form-dialog";
import { FormError } from "@/components/ui/form-error";
import { CATEGORY_ICON_NAMES } from "@/config/category-icons";
import { LISTING_KINDS } from "@/config/enums";
import { useAction } from "@/hooks/use-action";
import { api } from "@/lib/api-client";

// The categories guests browse by, kind by kind. The admin's table lists them; adding one and changing one open the
// same form in a pop-up. The slug and the kind are set when a category is made and never change.

export interface AdminCategory {
  slug: string;
  kind: ListingKind;
  nameEn: string;
  nameAr: string;
  icon: string;
  position: number;
  /** Places plus experiences using it; a used category cannot be deleted. */
  uses: number;
}

/** Makes a category when `category` is absent, and changes its names, icon and order otherwise. */
function CategoryForm({ category }: { category?: AdminCategory }) {
  const t = useTranslations("admin.categories");
  const { run, pending, error } = useAction();
  const closeDialog = useCloseDialog();

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const text = (name: string) => String(data.get(name) ?? "");
    const fields = {
      nameEn: text("nameEn"),
      nameAr: text("nameAr"),
      icon: text("icon"),
      position: Number(text("position")),
    };
    const saved = await run(() =>
      category
        ? api.patch(`/api/admin/categories/${category.slug}`, fields)
        : api.post("/api/admin/categories", { ...fields, slug: text("slug"), kind: text("kind") }),
    );
    if (saved) closeDialog();
  };

  return (
    <form onSubmit={(event) => void submit(event)} className="grid gap-4">
      <fieldset disabled={pending} className="grid gap-4 sm:grid-cols-2">
        {category ? null : (
          <>
            <LabeledControl label={t("slug")} hint={t("slugHint")}>
              <input
                name="slug"
                dir="ltr"
                required
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                maxLength={40}
                className={inputClass}
              />
            </LabeledControl>
            <LabeledControl label={t("kind")}>
              <select name="kind" className={inputClass}>
                {LISTING_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {t(`kinds.${kind}`)}
                  </option>
                ))}
              </select>
            </LabeledControl>
          </>
        )}
        <LabeledControl label={t("nameEn")}>
          <input
            name="nameEn"
            dir="ltr"
            required
            minLength={2}
            maxLength={40}
            defaultValue={category?.nameEn}
            className={inputClass}
          />
        </LabeledControl>
        <LabeledControl label={t("nameAr")}>
          <input
            name="nameAr"
            dir="rtl"
            required
            minLength={2}
            maxLength={40}
            defaultValue={category?.nameAr}
            className={inputClass}
          />
        </LabeledControl>
        <LabeledControl label={t("icon")}>
          <select name="icon" defaultValue={category?.icon} className={inputClass}>
            {CATEGORY_ICON_NAMES.map((icon) => (
              <option key={icon} value={icon}>
                {icon}
              </option>
            ))}
          </select>
        </LabeledControl>
        <LabeledControl label={t("position")}>
          <input
            name="position"
            type="number"
            min={0}
            max={999}
            defaultValue={category?.position ?? 0}
            className={inputClass}
          />
        </LabeledControl>
      </fieldset>
      <FormError message={error} />
      <Button type="submit" className="w-fit" disabled={pending}>
        {category ? t("save") : t("add")}
      </Button>
    </form>
  );
}

/** The page's "New category" button: the form in a pop-up. */
export function NewCategoryButton() {
  const t = useTranslations("admin.categories");
  return (
    <FormDialog label={t("new")} title={t("new")}>
      <CategoryForm />
    </FormDialog>
  );
}

/** A row's buttons: change the category in a pop-up, or delete it once nothing uses it. */
export function CategoryActions({ category }: { category: AdminCategory }) {
  const t = useTranslations("admin.categories");
  const { run, pending, error } = useAction();
  const { confirm, dialog } = useConfirm();

  const remove = async () => {
    const answer = await confirm({
      title: t("deleteTitle", { name: category.nameEn }),
      confirmLabel: t("delete"),
    });
    if (answer) await run(() => api.delete(`/api/admin/categories/${category.slug}`));
  };

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {dialog}
      <FormDialog
        label={t("edit")}
        title={t("editTitle", { name: category.nameEn })}
        icon={<Pencil className="size-4" aria-hidden />}
        variant="secondary"
      >
        <CategoryForm category={category} />
      </FormDialog>
      <Button
        size="icon"
        variant="ghost"
        disabled={pending || category.uses > 0}
        title={category.uses > 0 ? t("inUse", { count: category.uses }) : t("delete")}
        aria-label={t("deleteTitle", { name: category.nameEn })}
        onClick={() => void remove()}
      >
        <Trash2 className="size-4" aria-hidden />
      </Button>
      <FormError message={error} />
    </div>
  );
}
