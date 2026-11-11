import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { buttonClass } from "./button";
import { inputClass, labelledControlClass } from "./field";

export interface ListChoice {
  /** Its name in the address: `?status=SUSPENDED`. */
  name: string;
  label: string;
  value: string | undefined;
  options: Array<{ value: string; label: string }>;
}

/**
 * The search box and choices above a long list. It is a plain form that sends its fields in the address, so a
 * filtered list can be reloaded or shared, works before the page's JavaScript has loaded, and starts again at page 1.
 */
export async function ListFilters({
  label,
  path,
  search,
  searchPlaceholder,
  choices = [],
  total,
}: {
  label: string;
  /** The list's address, with no filters. */
  path: string;
  search: string;
  searchPlaceholder: string;
  choices?: ListChoice[];
  /** How many rows match, said under the form. */
  total: number;
}) {
  const t = await getTranslations("lists");
  const filtered = Boolean(search) || choices.some((choice) => choice.value);
  return (
    <div className="mb-4 grid gap-2">
      <form
        action={path}
        role="search"
        aria-label={label}
        className="flex flex-wrap items-end gap-3 rounded-xl bg-surface p-4 ring-1 ring-line"
      >
        <label className={`${labelledControlClass} min-w-0 flex-[2_1_14rem]`}>
          {t("search")}
          <input
            type="search"
            name="q"
            defaultValue={search}
            maxLength={100}
            placeholder={searchPlaceholder}
            className={inputClass}
          />
        </label>
        {choices.map((choice) => (
          <label key={choice.name} className={`${labelledControlClass} min-w-0 flex-[1_1_9rem]`}>
            {choice.label}
            <select name={choice.name} defaultValue={choice.value ?? ""} className={inputClass}>
              <option value="">{t("all")}</option>
              {choice.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ))}
        <div className="flex gap-2">
          <button type="submit" className={buttonClass({ size: "lg" })}>
            {t("apply")}
          </button>
          {filtered ? (
            <Link href={path} className={buttonClass({ size: "lg", variant: "ghost" })}>
              {t("clear")}
            </Link>
          ) : null}
        </div>
      </form>
      <p role="status" className="text-sm text-muted">
        {filtered ? t("matching", { count: total }) : t("count", { count: total })}
      </p>
    </div>
  );
}
