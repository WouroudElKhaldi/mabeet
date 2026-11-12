import clsx from "clsx";
import type { ReactNode } from "react";

export interface DataColumn {
  label: string;
  /** Numbers and actions sit at the end of the row. */
  align?: "end";
  /** Left out on a phone, where the row keeps only what tells it apart. */
  wide?: boolean;
  /** Read by screen readers only, for a column of buttons or links. */
  hiddenLabel?: boolean;
}

/**
 * A list of records as a table, one row each, for the admin's long lists. On a phone the `wide` columns drop out, so
 * the table fits without moving sideways; a row's main cell carries its second line instead.
 */
export function DataTable({
  label,
  columns,
  children,
}: {
  label: string;
  columns: DataColumn[];
  children: ReactNode;
}) {
  return (
    // Relative, so the screen-reader-only labels (absolutely placed) stay inside the box: otherwise a row wider than a
    // phone pushes them past the page's edge, in Arabic most of all, and the whole page moves sideways.
    <div className="relative overflow-x-auto rounded-xl bg-surface ring-1 ring-line">
      <table className="w-full text-sm">
        <caption className="sr-only">{label}</caption>
        <thead className="text-xs tracking-wide text-muted uppercase">
          <tr className="border-b border-line">
            {columns.map((column) => (
              <th
                key={column.label}
                scope="col"
                className={clsx(
                  "px-4 py-3 font-semibold",
                  column.align === "end" ? "text-end" : "text-start",
                  column.wide && "max-md:hidden",
                )}
              >
                <span className={column.hiddenLabel ? "sr-only" : undefined}>{column.label}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function DataRow({ children }: { children: ReactNode }) {
  return <tr className="border-b border-line align-top last:border-0">{children}</tr>;
}

export function DataCell({
  children,
  align,
  wide,
  className,
}: {
  children: ReactNode;
  align?: "end";
  wide?: boolean;
  className?: string;
}) {
  return (
    <td className={clsx("px-4 py-3", align === "end" && "text-end", wide && "max-md:hidden", className)}>
      {children}
    </td>
  );
}
